import { randomUUID } from 'node:crypto';
import { ERROR_CODE } from '@cip/shared';
import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { ArtifactKind } from '../domain/artifact.entity';
import {
  ASSIGNMENT_REPOSITORY,
  type AssignmentRepository,
} from '../domain/assignment.repository';
import { metrics } from '../domain/metrics.port';
import { readPermissionWindow } from '../domain/policy.entity';
import {
  POLICY_REPOSITORY,
  type PolicyRepository,
} from '../domain/policy.repository';
import type { ReportKind } from '../domain/report.entity';
import { Report } from '../domain/report.entity';
import {
  REPORT_REPOSITORY,
  type ReportRepository,
} from '../domain/report.repository';
import type { Ticket } from '../domain/ticket.entity';
import {
  TICKET_REPOSITORY,
  type TicketRepository,
} from '../domain/ticket.repository';
import { ArtifactService } from './artifact.service';
import { AssignmentService } from './assignment.service';
import { AuditRecordService } from './audit-record.service';
import { EffectivePermissionService } from './effective-permission.service';
import { RunFailureService } from './run-failure.service';

/** 内部运行创建输入。 */
export interface StartRunInput {
  /** 工单主键。 */
  ticketId: string;
  /** 执行器运行标识。 */
  executorRunId: string;
  /** 当前时间；缺省为系统时间。 */
  now?: Date;
}

/** 内部回报输入。 */
export interface AppendReportInput {
  /** 派发主键。 */
  assignmentId: string;
  /** 回报类型。 */
  kind: ReportKind;
  /** 回报负载。 */
  payload: unknown;
  /** 当前时间。 */
  now?: Date;
}

/** 内部产物写入输入。 */
export interface WriteRunArtifactInput {
  /** 工单主键。 */
  ticketId: string;
  /** 产物类型。 */
  kind: ArtifactKind;
  /** 产物负载。 */
  payload: unknown;
  /** 所属派发主键。 */
  assignmentId?: string | null;
  /** 当前时间。 */
  now?: Date;
}

/** 读取回报摘要；仅接受字符串 summary。 */
function readSummary(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const summary = (payload as { summary?: unknown }).summary;
  return typeof summary === 'string' && summary.trim() ? summary.trim() : null;
}

/** 终止性回报：收到后结束派发。 */
const FINAL_REPORT_KINDS: readonly ReportKind[] = [
  'ready',
  'blocked',
  'failed',
];

/**
 * 内部运行契约用例：执行器经 `/internal/*` 创建运行、追加回报、写产物。
 * 所有写操作记录内部审计，actorId 为空（服务间调用）。
 */
@Injectable()
export class InternalRuntimeService {
  constructor(
    private readonly assignments: AssignmentService,
    @Inject(ASSIGNMENT_REPOSITORY)
    private readonly assignmentRows: AssignmentRepository,
    @Inject(REPORT_REPOSITORY) private readonly reports: ReportRepository,
    @Inject(TICKET_REPOSITORY) private readonly tickets: TicketRepository,
    private readonly artifacts: ArtifactService,
    private readonly audit: AuditRecordService,
    private readonly effective: EffectivePermissionService,
    private readonly runFailure: RunFailureService,
    @Inject(POLICY_REPOSITORY)
    private readonly policies: PolicyRepository,
  ) {}

  /** 创建或恢复运行：已有活跃派发直接复用，pending 时以执行器 runId 启动。 */
  async startRun(input: StartRunInput): Promise<{
    assignmentId: string;
    status: string;
    executorRunId: string | null;
  }> {
    const ticket = await this.tickets.findById(input.ticketId);
    if (!ticket) throw new Error(`工单不存在：${input.ticketId}`);
    await this.assertAllowed('runs:start', ticket.scopeKey, input.now);
    const assignment = await this.assignments.assign(input.ticketId, input.now);
    const running =
      assignment.status === 'pending'
        ? await this.assignments.start(
            assignment.id,
            input.executorRunId,
            input.now,
          )
        : assignment;
    await this.audit.record({
      traceId: input.executorRunId,
      actorId: null,
      action: 'internal.run.start',
      method: 'INTERNAL',
      path: 'runs',
      statusCode: 200,
      detail: {
        ticketId: input.ticketId,
        threadId: ticket.threadId,
        mandateId: ticket.mandateId,
        assignmentId: running.id,
      },
      now: input.now,
    });
    return {
      assignmentId: running.id,
      status: running.status,
      executorRunId: running.executorRunId,
    };
  }

  /** 追加回报；终止性回报同时结束派发。 */
  async appendReport(input: AppendReportInput): Promise<{ reportId: string }> {
    const assignment = await this.assignmentRows.findById(input.assignmentId);
    if (!assignment) throw new Error(`派发不存在：${input.assignmentId}`);
    const ticket = await this.tickets.findById(assignment.ticketId);
    await this.assertAllowed(
      'reports:append',
      ticket?.scopeKey ?? null,
      input.now,
    );
    const now = input.now ?? new Date();
    const report = Report.create({
      id: randomUUID(),
      assignmentId: input.assignmentId,
      kind: input.kind,
      payload: input.payload,
      now: input.now,
    });
    await this.reports.create(report);
    if (FINAL_REPORT_KINDS.includes(input.kind)) {
      await this.assignments.finish(
        assignment.id,
        input.kind === 'ready'
          ? null
          : (readSummary(input.payload) ?? '执行器报告未就绪'),
        now,
      );
      if (ticket)
        await this.settleTicket(
          ticket,
          assignment.id,
          assignment.executorRunId ?? assignment.id,
          input,
          now,
        );
    }
    await this.audit.record({
      traceId: assignment.executorRunId ?? assignment.id,
      actorId: null,
      action: 'internal.report.append',
      method: 'INTERNAL',
      path: 'reports',
      statusCode: 200,
      detail: {
        assignmentId: assignment.id,
        ticketId: assignment.ticketId,
        kind: input.kind,
      },
      now,
    });
    return { reportId: report.id };
  }

  /**
   * 最终报告推进工单：ready 自动结束；blocked/failed 保持打开并转人工移交。
   * 工单已结束时不再重复结束；移交对开放工单最多产生一条未关闭 review 关注。
   */
  private async settleTicket(
    ticket: Ticket,
    assignmentId: string,
    traceId: string,
    input: AppendReportInput,
    now: Date,
  ): Promise<void> {
    if (input.kind === 'ready') {
      if (!ticket.isOpen) return;
      ticket.end(readSummary(input.payload) ?? '执行器报告就绪', now);
      await this.tickets.save(ticket);
      metrics.increment('agentic_events_total', { event: 'ticket_ended' });
      await this.audit.record({
        traceId,
        actorId: null,
        action: 'internal.ticket.end',
        method: 'INTERNAL',
        path: 'reports',
        statusCode: 200,
        detail: {
          ticketId: ticket.id,
          assignmentId,
          kind: input.kind,
          endReason: ticket.endReason,
        },
        now,
      });
      return;
    }

    if (!ticket.isOpen) return;
    const attention = await this.runFailure.report({
      ticketId: ticket.id,
      role: 'executor',
      error: readSummary(input.payload) ?? '执行器报告未就绪',
      now,
    });
    await this.audit.record({
      traceId,
      actorId: null,
      action: 'internal.ticket.handover',
      method: 'INTERNAL',
      path: 'reports',
      statusCode: 200,
      detail: {
        ticketId: ticket.id,
        assignmentId,
        kind: input.kind,
        ...(attention ? { attentionId: attention.id } : {}),
      },
      now,
    });
  }

  /** 写入执行产物；工单必须存在。 */
  async writeArtifact(input: WriteRunArtifactInput): Promise<{
    artifactId: string;
    version: number;
  }> {
    const ticket = await this.tickets.findById(input.ticketId);
    if (!ticket) throw new Error(`工单不存在：${input.ticketId}`);
    await this.assertAllowed('artifacts:write', ticket.scopeKey, input.now);
    const artifact = await this.artifacts.publish({
      ticketId: input.ticketId,
      kind: input.kind,
      payload: input.payload,
      assignmentId: input.assignmentId ?? null,
      now: input.now,
    });
    await this.audit.record({
      traceId: input.assignmentId ?? artifact.id,
      actorId: null,
      action: 'internal.artifact.write',
      method: 'INTERNAL',
      path: 'artifacts',
      statusCode: 200,
      detail: {
        ticketId: input.ticketId,
        artifactId: artifact.id,
        kind: input.kind,
        version: artifact.version,
      },
      now: input.now,
    });
    return { artifactId: artifact.id, version: artifact.version };
  }

  /** 校验服务令牌有效权限；拒绝时写审计并抛 403。 */
  private async assertAllowed(
    action: 'runs:start' | 'reports:append' | 'artifacts:write',
    scopeKey: string | null,
    now: Date | undefined,
  ): Promise<void> {
    const at = now ?? new Date();
    const policy = await this.policies.findCurrent();
    const decision = this.effective.checkInternal(
      action,
      scopeKey,
      at,
      readPermissionWindow(policy?.rules, at),
    );
    if (decision.allowed) return;
    await this.audit.record({
      traceId: `${action}-denied`,
      actorId: null,
      action: 'internal.authz.deny',
      method: 'INTERNAL',
      path: action.split(':')[0] ?? 'internal',
      statusCode: 403,
      detail: { action, scopeKey, reasons: decision.reasons },
      now,
    });
    throw new ForbiddenException({
      code: ERROR_CODE.auth.forbidden,
      message: `内部令牌范围不允许：${decision.reasons.join(',')}`,
    });
  }
}
