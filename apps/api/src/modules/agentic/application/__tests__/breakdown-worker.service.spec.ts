import { describe, expect, it } from 'vitest';
import type { QueueService } from '../../../../platform/queue';
import { Artifact } from '../../domain/artifact.entity';
import type { ArtifactRepository } from '../../domain/artifact.repository';
import type { Policy } from '../../domain/policy.entity';
import { Policy as PolicyAggregate } from '../../domain/policy.entity';
import type { PolicyRepository } from '../../domain/policy.repository';
import { Ticket } from '../../domain/ticket.entity';
import type { TicketRepository } from '../../domain/ticket.repository';
import { Trigger } from '../../domain/trigger.entity';
import type { TriggerRepository } from '../../domain/trigger.repository';
import type { AuditRecordService } from '../audit-record.service';
import type { BreakdownService } from '../breakdown.service';
import { BreakdownWorkerService } from '../breakdown-worker.service';
import type { RunFailureService } from '../run-failure.service';

const AT = new Date('2026-11-16T00:00:00.000Z');

class FakeTicketRepository implements TicketRepository {
  constructor(private readonly ticket: Ticket | null) {}
  async findById(): Promise<Ticket | null> {
    return this.ticket;
  }
  async findByMandateId(): Promise<Ticket | null> {
    return null;
  }
  async list(): Promise<Ticket[]> {
    return [];
  }
  async listByThread(): Promise<Ticket[]> {
    return [];
  }
  async save(): Promise<void> {}
}

class FakeArtifactRepository implements ArtifactRepository {
  constructor(private readonly artifact: Artifact | null) {}
  async findById(): Promise<Artifact | null> {
    return null;
  }
  async listByTicket(): Promise<Artifact[]> {
    return this.artifact ? [this.artifact] : [];
  }
  async findLatest(): Promise<Artifact | null> {
    return this.artifact;
  }
  async save(): Promise<void> {}
}

class FakeTriggerRepository implements TriggerRepository {
  constructor(private readonly rows: Trigger[]) {}
  async findByDedupeKey(): Promise<Trigger | null> {
    return null;
  }
  async create(): Promise<boolean> {
    return true;
  }
  async listByThread(): Promise<Trigger[]> {
    return this.rows;
  }
  async listByIds(): Promise<Trigger[]> {
    return this.rows;
  }
  async saveDisposition(): Promise<void> {}
}

class FakePolicyRepository implements PolicyRepository {
  constructor(private readonly policy: Policy | null) {}
  async findById(): Promise<Policy | null> {
    return this.policy;
  }
  async findCurrent(): Promise<Policy | null> {
    return this.policy;
  }
  async findByVersion(): Promise<Policy | null> {
    return this.policy;
  }
  async create(): Promise<void> {}
}

class FakeRunFailure {
  readonly reports: Array<{
    ticketId: string;
    role: string;
    error: string;
  }> = [];
  async report(input: {
    ticketId: string;
    role: string;
    error: string;
  }): Promise<null> {
    this.reports.push(input);
    return null;
  }
}

class FakeAudit {
  readonly records: Array<{
    action: string;
    path: string;
    statusCode: number;
    detail: unknown;
  }> = [];
  async record(input: {
    action: string;
    path: string;
    statusCode: number;
    detail: unknown;
  }): Promise<void> {
    this.records.push(input);
  }
}

class FakeBreakdown {
  error: Error | null = null;
  readonly calls: Array<{
    ticketId: string;
    triggers: number;
    speculative: boolean;
    hasClarify: boolean;
  }> = [];
  async start(
    input: {
      ticketId: string;
      triggers: Trigger[];
      clarifyArtifact?: unknown;
    },
    options: { speculative?: boolean } = {},
  ): Promise<void> {
    if (this.error) throw this.error;
    this.calls.push({
      ticketId: input.ticketId,
      triggers: input.triggers.length,
      speculative: options.speculative === true,
      hasClarify: input.clarifyArtifact != null,
    });
  }
}

function makeService(options?: {
  ticketOpen?: boolean;
  policy?: Policy | null;
  triggers?: Trigger[];
  clarify?: Artifact | null;
}): {
  service: BreakdownWorkerService;
  breakdown: FakeBreakdown;
  audit: FakeAudit;
  runFailure: FakeRunFailure;
} {
  const ticket = Ticket.open({
    id: 'ticket-1',
    mandateId: 'mandate-1',
    threadId: 'thread-1',
    kind: 'requirement',
    now: AT,
  });
  if (options?.ticketOpen === false) ticket.end('已结束', AT);
  const policy =
    options && 'policy' in options
      ? (options.policy ?? null)
      : PolicyAggregate.create({
          id: 'policy-1',
          version: 1,
          acceptMode: 'explicit',
          rules: {},
          createdBy: 'admin',
          now: AT,
        });
  const trigger = Trigger.create({
    id: 'trigger-1',
    dedupeKey: 'lark:1',
    sourceType: 'lark',
    instanceId: 'instance-1',
    threadId: 'thread-1',
    actorId: 'actor-1',
    text: '需求正文',
    payload: {},
    occurredAt: AT,
  });
  const breakdown = new FakeBreakdown();
  const audit = new FakeAudit();
  const runFailure = new FakeRunFailure();
  const service = new BreakdownWorkerService(
    {} as QueueService,
    new FakeTicketRepository(ticket),
    new FakePolicyRepository(policy),
    new FakeTriggerRepository(options?.triggers ?? [trigger]),
    new FakeArtifactRepository(options?.clarify ?? null),
    breakdown as unknown as BreakdownService,
    audit as unknown as AuditRecordService,
    runFailure as unknown as RunFailureService,
  );
  return { service, breakdown, audit, runFailure };
}

describe('BreakdownWorkerService.handle', () => {
  it('工单打开且有策略时触发拆解', async () => {
    const { service, breakdown } = makeService();

    await service.handle({
      ticketId: 'ticket-1',
      threadId: 'thread-1',
      triggerIds: ['trigger-1'],
    });

    expect(breakdown.calls).toHaveLength(1);
    expect(breakdown.calls[0].triggers).toBe(1);
    expect(breakdown.calls[0].speculative).toBe(false);
    expect(breakdown.calls[0].hasClarify).toBe(false);
  });

  it('把已确认澄清稿作为拆解上下文', async () => {
    const clarify = Artifact.create({
      id: 'artifact-clarify',
      ticketId: 'ticket-1',
      kind: 'clarify',
      version: 1,
      payload: { summary: '澄清摘要', draft: { goal: '导出' }, questions: [] },
      now: AT,
    });
    const { service, breakdown } = makeService({ clarify });

    await service.handle({
      ticketId: 'ticket-1',
      threadId: 'thread-1',
      triggerIds: ['trigger-1'],
    });

    expect(breakdown.calls[0].hasClarify).toBe(true);
  });

  it('投机任务按投机模式执行', async () => {
    const { service, breakdown } = makeService();

    await service.handle({
      ticketId: 'ticket-1',
      threadId: 'thread-1',
      triggerIds: ['trigger-1'],
      speculative: true,
    });

    expect(breakdown.calls[0].speculative).toBe(true);
  });

  it('工单已结束时跳过', async () => {
    const { service, breakdown } = makeService({ ticketOpen: false });
    await service.handle({
      ticketId: 'ticket-1',
      threadId: 'thread-1',
      triggerIds: [],
    });
    expect(breakdown.calls).toHaveLength(0);
  });

  it('策略缺失时跳过', async () => {
    const { service, breakdown } = makeService({ policy: null });
    await service.handle({
      ticketId: 'ticket-1',
      threadId: 'thread-1',
      triggerIds: [],
    });
    expect(breakdown.calls).toHaveLength(0);
  });
});

describe('BreakdownWorkerService 运行审计', () => {
  it('成功运行写 agentic.run 审计', async () => {
    const { service, audit } = makeService();

    await service.handle({
      ticketId: 'ticket-1',
      threadId: 'thread-1',
      triggerIds: ['trigger-1'],
    });

    expect(audit.records).toHaveLength(1);
    expect(audit.records[0].statusCode).toBe(200);
    expect(audit.records[0].detail).toMatchObject({
      ticketId: 'ticket-1',
      policyVersion: 1,
      triggerIds: ['trigger-1'],
    });
    expect((audit.records[0].detail as { mandateId: string }).mandateId).toBe(
      'mandate-1',
    );
  });

  it('失败运行写 500 审计并继续抛出', async () => {
    const { service, breakdown, audit } = makeService();
    breakdown.error = new Error('拆解失败');

    await expect(
      service.handle({
        ticketId: 'ticket-1',
        threadId: 'thread-1',
        triggerIds: ['trigger-1'],
      }),
    ).rejects.toThrow('拆解失败');

    expect(audit.records[0].statusCode).toBe(500);
  });
});

describe('BreakdownWorkerService.handleJob', () => {
  it('末次尝试失败时转人工关注', async () => {
    const { service, breakdown, runFailure } = makeService();
    breakdown.error = new Error('拆解失败');

    await expect(
      service.handleJob({
        data: {
          ticketId: 'ticket-1',
          threadId: 'thread-1',
          triggerIds: ['trigger-1'],
        },
        opts: { attempts: 2 },
        attemptsMade: 1,
      } as never),
    ).rejects.toThrow('拆解失败');

    expect(runFailure.reports).toEqual([
      { ticketId: 'ticket-1', role: 'breakdown', error: '拆解失败' },
    ]);
  });
});
