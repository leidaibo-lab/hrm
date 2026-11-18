import { describe, expect, it } from 'vitest';
import { Assignment } from '../../domain/assignment.entity';
import type { AssignmentRepository } from '../../domain/assignment.repository';
import type { Attention } from '../../domain/attention.entity';
import type { Report } from '../../domain/report.entity';
import type { ReportRepository } from '../../domain/report.repository';
import { Ticket } from '../../domain/ticket.entity';
import type { TicketRepository } from '../../domain/ticket.repository';
import type { ArtifactService } from '../artifact.service';
import type { AssignmentService } from '../assignment.service';
import type { AuditRecordService } from '../audit-record.service';
import { EffectivePermissionService } from '../effective-permission.service';
import { InternalRuntimeService } from '../internal-runtime.service';
import type { RunFailureService } from '../run-failure.service';

const AT = new Date('2026-11-16T00:00:00.000Z');

class FakeAssignmentRepository implements AssignmentRepository {
  readonly rows: Assignment[] = [];
  async findById(id: string): Promise<Assignment | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }
  async findActiveByTicket(ticketId: string): Promise<Assignment | null> {
    return (
      this.rows.find(
        (row) => row.ticketId === ticketId && row.status !== 'ended',
      ) ?? null
    );
  }
  async listByTicket(ticketId: string): Promise<Assignment[]> {
    return this.rows.filter((row) => row.ticketId === ticketId);
  }
  async save(assignment: Assignment): Promise<void> {
    const index = this.rows.findIndex((row) => row.id === assignment.id);
    if (index >= 0) this.rows[index] = assignment;
    else this.rows.push(assignment);
  }
}

class FakeReportRepository implements ReportRepository {
  readonly rows: Report[] = [];
  async findById(): Promise<Report | null> {
    return null;
  }
  async listByAssignment(): Promise<Report[]> {
    return this.rows;
  }
  async create(report: Report): Promise<void> {
    this.rows.push(report);
  }
}

class FakeAudit {
  readonly records: Array<{ action: string }> = [];
  async record(input: { action: string }): Promise<void> {
    this.records.push(input);
  }
}

class FakeArtifacts {
  calls = 0;
  async publish(input: { ticketId: string }): Promise<{
    id: string;
    version: number;
  }> {
    this.calls += 1;
    return { id: `artifact-${input.ticketId}`, version: 1 };
  }
}

class FakeRunFailure {
  readonly reports: Array<{ ticketId: string; role: string; error: string }> =
    [];
  async report(input: {
    ticketId: string;
    role: string;
    error: string;
  }): Promise<Attention> {
    this.reports.push(input);
    return { id: 'attention-1' } as Attention;
  }
}

function makeService(): {
  service: InternalRuntimeService;
  assignments: FakeAssignmentRepository;
  reports: FakeReportRepository;
  audit: FakeAudit;
  artifacts: FakeArtifacts;
  runFailure: FakeRunFailure;
  ticket: Ticket;
  policies: { current: unknown };
} {
  const assignments = new FakeAssignmentRepository();
  const reports = new FakeReportRepository();
  const audit = new FakeAudit();
  const artifacts = new FakeArtifacts();
  const runFailure = new FakeRunFailure();
  const policies: { current: unknown } = { current: null };
  const ticket = Ticket.open({
    id: 'ticket-1',
    mandateId: 'mandate-1',
    threadId: 'thread-1',
    kind: 'requirement',
    now: AT,
  });
  let saved = ticket;
  const tickets = {
    findById: async () => saved,
    save: async (next: Ticket) => {
      saved = next;
    },
  } as unknown as TicketRepository;

  const assignmentService = {
    assign: async (ticketId: string) => {
      const existing = assignments.rows.find(
        (row) => row.ticketId === ticketId && row.status !== 'ended',
      );
      if (existing) return existing;
      const assignment = Assignment.create({
        id: 'assignment-1',
        ticketId,
        now: AT,
      });
      assignments.rows.push(assignment);
      return assignment;
    },
    start: async (id: string, executorRunId: string) => {
      const assignment = assignments.rows.find((row) => row.id === id);
      if (!assignment) throw new Error('missing');
      assignment.start(executorRunId, AT);
      return assignment;
    },
    finish: async (id: string, error?: string | null) => {
      const assignment = assignments.rows.find((row) => row.id === id);
      if (!assignment) throw new Error('missing');
      assignment.end(AT, error ?? null);
      return assignment;
    },
  } as unknown as AssignmentService;

  return {
    service: new InternalRuntimeService(
      assignmentService,
      assignments,
      reports,
      tickets,
      artifacts as unknown as ArtifactService,
      audit as unknown as AuditRecordService,
      new EffectivePermissionService(),
      runFailure as unknown as RunFailureService,
      {
        findCurrent: async () => policies.current,
      } as never,
    ),
    assignments,
    reports,
    audit,
    artifacts,
    runFailure,
    ticket: saved,
    policies,
  };
}

describe('InternalRuntimeService', () => {
  it('创建运行并在 pending 时启动', async () => {
    const { service, assignments, audit } = makeService();
    const result = await service.startRun({
      ticketId: 'ticket-1',
      executorRunId: 'run-1',
      now: AT,
    });

    expect(result.status).toBe('running');
    expect(assignments.rows[0].executorRunId).toBe('run-1');
    expect(audit.records[0].action).toBe('internal.run.start');
  });

  it('ready 回报结束派发并自动结束工单', async () => {
    const { service, assignments, reports, audit, runFailure, ticket } =
      makeService();
    await service.startRun({
      ticketId: 'ticket-1',
      executorRunId: 'run-1',
      now: AT,
    });

    await service.appendReport({
      assignmentId: 'assignment-1',
      kind: 'ready',
      payload: { summary: '完成' },
      now: AT,
    });

    expect(reports.rows).toHaveLength(1);
    expect(assignments.rows[0].status).toBe('ended');
    expect(ticket.status).toBe('ended');
    expect(ticket.endReason).toBe('完成');
    expect(runFailure.reports).toEqual([]);
    expect(audit.records.map((record) => record.action)).toContain(
      'internal.ticket.end',
    );
  });

  it('blocked 回报结束派发、保持工单并转人工移交', async () => {
    const { service, assignments, audit, runFailure, ticket } = makeService();
    await service.startRun({
      ticketId: 'ticket-1',
      executorRunId: 'run-1',
      now: AT,
    });

    await service.appendReport({
      assignmentId: 'assignment-1',
      kind: 'blocked',
      payload: { summary: '等待环境权限' },
      now: AT,
    });

    expect(assignments.rows[0].status).toBe('ended');
    expect(assignments.rows[0].error).toBe('等待环境权限');
    expect(ticket.isOpen).toBe(true);
    expect(runFailure.reports[0]).toMatchObject({
      ticketId: 'ticket-1',
      role: 'executor',
      error: '等待环境权限',
    });
    expect(audit.records.map((record) => record.action)).toContain(
      'internal.ticket.handover',
    );
  });

  it('failed 回报同样保持工单并移交', async () => {
    const { service, runFailure, ticket } = makeService();
    await service.startRun({
      ticketId: 'ticket-1',
      executorRunId: 'run-1',
      now: AT,
    });

    await service.appendReport({
      assignmentId: 'assignment-1',
      kind: 'failed',
      payload: { summary: '模型调用失败' },
      now: AT,
    });

    expect(ticket.isOpen).toBe(true);
    expect(runFailure.reports[0]?.error).toBe('模型调用失败');
  });

  it('progress 回报不结束派发也不改工单', async () => {
    const { service, assignments, runFailure, ticket } = makeService();
    await service.startRun({
      ticketId: 'ticket-1',
      executorRunId: 'run-1',
      now: AT,
    });

    await service.appendReport({
      assignmentId: 'assignment-1',
      kind: 'progress',
      payload: { summary: '已完成一半' },
      now: AT,
    });

    expect(assignments.rows[0].status).toBe('running');
    expect(ticket.isOpen).toBe(true);
    expect(runFailure.reports).toEqual([]);
  });

  it('策略时间窗外拒绝内部写操作', async () => {
    const { service, policies } = makeService();
    policies.current = {
      rules: {
        permissionWindow: {
          start: '09:00',
          end: '19:00',
          timezone: 'Asia/Shanghai',
        },
      },
    };

    await expect(
      service.writeArtifact({
        ticketId: 'ticket-1',
        kind: 'report',
        payload: { summary: '窗外写入' },
        now: new Date('2026-11-16T12:30:00.000Z'),
      }),
    ).rejects.toThrow('内部令牌范围不允许');
  });

  it('写入产物并审计', async () => {
    const { service, artifacts, audit } = makeService();
    const result = await service.writeArtifact({
      ticketId: 'ticket-1',
      kind: 'report',
      payload: { summary: '执行完成' },
      now: AT,
    });

    expect(artifacts.calls).toBe(1);
    expect(result.artifactId).toBe('artifact-ticket-1');
    expect(audit.records[0].action).toBe('internal.artifact.write');
  });
});
