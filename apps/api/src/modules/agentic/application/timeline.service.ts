import { Inject, Injectable } from '@nestjs/common';
import {
  ARTIFACT_REPOSITORY,
  type ArtifactRepository,
} from '../domain/artifact.repository';
import {
  ASSIGNMENT_REPOSITORY,
  type AssignmentRepository,
} from '../domain/assignment.repository';
import {
  ATTENTION_REPOSITORY,
  type AttentionRepository,
} from '../domain/attention.repository';
import {
  DECISION_REPOSITORY,
  type DecisionRepository,
} from '../domain/decision.repository';
import { readPolicyRules } from '../domain/policy.entity';
import {
  POLICY_REPOSITORY,
  type PolicyRepository,
} from '../domain/policy.repository';
import {
  REPORT_REPOSITORY,
  type ReportRepository,
} from '../domain/report.repository';
import {
  THREAD_REPOSITORY,
  type ThreadRepository,
} from '../domain/thread.repository';
import {
  TICKET_REPOSITORY,
  type TicketRepository,
} from '../domain/ticket.repository';
import {
  TRIGGER_REPOSITORY,
  type TriggerRepository,
} from '../domain/trigger.repository';

/** 轨迹事件类型。 */
export type TimelineEventType =
  | 'trigger'
  | 'decision'
  | 'artifact'
  | 'assignment'
  | 'attention'
  | 'report';

/** 轨迹事件。 */
export interface TimelineEvent {
  /** 事件主键。 */
  id: string;
  /** 事件类型。 */
  type: TimelineEventType;
  /** 发生时间。 */
  at: string;
  /** 摘要。 */
  summary: string;
  /** 结构详情；过滤事件带 disposition 与 filterReason。 */
  detail?: unknown;
}

/** 回放快照：该时刻的工单与产物状态。 */
export interface TimelineSnapshot {
  /** 工单状态。 */
  status: string;
  /** 结束原因。 */
  endReason?: string;
  /** 截至该时刻的产物。 */
  artifacts: Array<{
    /** 产物类型。 */
    kind: string;
    /** 版本号。 */
    version: number;
    /** 状态。 */
    status: string;
    /** 产物内容。 */
    payload: unknown;
  }>;
  /** 截至该时刻的关注。 */
  attentions: Array<{
    /** 问题主键。 */
    id: string;
    /** 问题文本。 */
    question: string;
    /** 该时刻状态。 */
    status: string;
    /** 回答时间。 */
    decidedAt?: string;
  }>;
}

/** 工单轨迹。 */
export interface TicketTimeline {
  /** 工单主键。 */
  ticketId: string;
  /** 线程主键。 */
  threadId: string;
  /** 按时间升序的事件。 */
  events: TimelineEvent[];
  /** 回放快照。 */
  snapshot: TimelineSnapshot;
}

/** 审计轨迹：把事件、结论、产物、派发按时间合并。 */
@Injectable()
export class TimelineService {
  constructor(
    @Inject(TICKET_REPOSITORY) private readonly tickets: TicketRepository,
    @Inject(THREAD_REPOSITORY) private readonly threads: ThreadRepository,
    @Inject(TRIGGER_REPOSITORY) private readonly triggers: TriggerRepository,
    @Inject(DECISION_REPOSITORY)
    private readonly decisions: DecisionRepository,
    @Inject(ARTIFACT_REPOSITORY) private readonly artifacts: ArtifactRepository,
    @Inject(ASSIGNMENT_REPOSITORY)
    private readonly assignments: AssignmentRepository,
    @Inject(ATTENTION_REPOSITORY)
    private readonly attentions: AttentionRepository,
    @Inject(REPORT_REPOSITORY) private readonly reports: ReportRepository,
    @Inject(POLICY_REPOSITORY) private readonly policies: PolicyRepository,
  ) {}

  /** 取工单轨迹；until 给定时只返回到该时刻为止。 */
  async forTicket(
    ticketId: string,
    until?: Date,
  ): Promise<TicketTimeline | null> {
    const ticket = await this.tickets.findById(ticketId);
    if (!ticket) return null;
    const thread = await this.threads.findById(ticket.threadId);

    const [triggers, decisions, artifacts, assignments, attentions] =
      await Promise.all([
        thread ? this.triggers.listByThread(thread.id) : Promise.resolve([]),
        thread ? this.decisions.listByThread(thread.id) : Promise.resolve([]),
        this.artifacts.listByTicket(ticketId),
        this.assignments.listByTicket(ticketId),
        this.attentions.listByTicket(ticketId),
      ]);
    const reports = (
      await Promise.all(
        assignments.map((assignment) =>
          this.reports.listByAssignment(assignment.id),
        ),
      )
    ).flat();

    const events: TimelineEvent[] = [
      ...triggers.map((trigger) => ({
        id: trigger.id,
        type: 'trigger' as const,
        at: trigger.occurredAt.toISOString(),
        summary: trigger.text,
        ...(trigger.disposition === 'filtered'
          ? {
              detail: {
                disposition: trigger.disposition,
                filterReason: trigger.filterReason,
              },
            }
          : {}),
      })),
      ...decisions.map((decision) => ({
        id: decision.id,
        type: 'decision' as const,
        at: decision.createdAt.toISOString(),
        summary: `${decision.kind} · ${decision.reason ?? '无说明'}`,
      })),
      ...artifacts.map((artifact) => ({
        id: artifact.id,
        type: 'artifact' as const,
        at: artifact.createdAt.toISOString(),
        summary: `${artifact.kind} v${artifact.version} · ${artifact.status}`,
      })),
      ...assignments.map((assignment) => ({
        id: assignment.id,
        type: 'assignment' as const,
        at: assignment.createdAt.toISOString(),
        summary: `${assignment.status} · 第 ${assignment.attempt} 次`,
      })),
      ...attentions.map((attention) => ({
        id: attention.id,
        type: 'attention' as const,
        at: attention.createdAt.toISOString(),
        summary: `${attention.kind} · ${attention.question}`,
      })),
      ...attentions
        .filter((attention) => attention.decidedAt)
        .map((attention) => ({
          id: `${attention.id}:answer`,
          type: 'attention' as const,
          at: attention.decidedAt?.toISOString() ?? '',
          summary: `answered · ${attention.decidedBy ?? '未知'}`,
        })),
      ...reports.map((report) => ({
        id: report.id,
        type: 'report' as const,
        at: report.createdAt.toISOString(),
        summary: `${report.kind}`,
      })),
    ].sort((left, right) => left.at.localeCompare(right.at));

    const filtered = until
      ? events.filter((event) => new Date(event.at) <= until)
      : events;
    const visibleArtifacts = until
      ? artifacts.filter((artifact) => artifact.createdAt <= until)
      : artifacts;
    const policy = await this.policies.findCurrent();
    const redactFields = readPolicyRules(policy?.rules).auditRedactFields ?? [];
    const ended =
      ticket.endedAt !== null && (until ? ticket.endedAt <= until : true);
    return {
      ticketId,
      threadId: ticket.threadId,
      events: filtered,
      snapshot: {
        status: ended ? ticket.status : 'open',
        ...(ended && ticket.endReason ? { endReason: ticket.endReason } : {}),
        artifacts: visibleArtifacts.map((artifact) => ({
          kind: artifact.kind,
          version: artifact.version,
          status: artifact.status,
          payload: redact(artifact.payload, redactFields),
        })),
        attentions: (until
          ? attentions.filter((attention) => attention.createdAt <= until)
          : attentions
        ).map((attention) => ({
          id: attention.id,
          question: attention.question,
          status:
            attention.decidedAt && until && attention.decidedAt > until
              ? 'open'
              : attention.status,
          ...(attention.decidedAt
            ? { decidedAt: attention.decidedAt.toISOString() }
            : {}),
        })),
      },
    };
  }
}

/** 递归脱敏指定字段名。 */
function redact(value: unknown, fields: string[]): unknown {
  if (fields.length === 0) return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, fields));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) =>
      fields.includes(key) ? [key, '***'] : [key, redact(item, fields)],
    ),
  );
}
