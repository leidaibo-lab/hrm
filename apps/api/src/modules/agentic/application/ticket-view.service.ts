import type { Artifact } from '../domain/artifact.entity';
import type { Assignment } from '../domain/assignment.entity';
import type { Attention } from '../domain/attention.entity';
import { type Conflict, detectConflicts } from '../domain/conflict.entity';
import type { Mandate } from '../domain/mandate.entity';
import type { Thread } from '../domain/thread.entity';
import type { Ticket, TicketKind, TicketStatus } from '../domain/ticket.entity';
import type { Trigger } from '../domain/trigger.entity';

/** 工单视图：日期统一 ISO 字符串。 */
export interface TicketView {
  /** 工单主键。 */
  id: string;
  /** 授权主键。 */
  mandateId: string;
  /** 线程主键。 */
  threadId: string;
  /** 项目或空间。 */
  scopeKey?: string;
  /** 工单类型。 */
  kind: TicketKind;
  /** 状态。 */
  status: TicketStatus;
  /** 开启时间。 */
  openedAt: string;
  /** 结束时间。 */
  endedAt?: string;
  /** 结束原因。 */
  endReason?: string;
  /** 等待对象：最早截止的未关闭关注负责人。 */
  assignee?: string;
  /** 最近截止时间。 */
  deadline?: string;
  /** 是否已过截止时间。 */
  overdue: boolean;
  /** 未关闭关注数。 */
  waitingCount: number;
}

/** 关注视图。 */
export interface AttentionView {
  /** 关注主键。 */
  id: string;
  /** 工单主键。 */
  ticketId: string;
  /** 类型。 */
  kind: string;
  /** 问题。 */
  question: string;
  /** 状态。 */
  status: string;
  /** 等待对象。 */
  assignee: string;
  /** 截止时间。 */
  deadline: string;
  /** 决定人。 */
  decidedBy?: string;
  /** 决定时间。 */
  decidedAt?: string;
  /** 答案。 */
  answer: unknown;
}

/** 授权视图。 */
export interface MandateView {
  /** 授权主键。 */
  id: string;
  /** 策略主键。 */
  policyId: string;
  /** 策略版本。 */
  policyVersion: number;
  /** 强度。 */
  strength: string;
  /** 范围。 */
  scope: unknown;
  /** 发起人。 */
  actorId: string;
  /** 授权时间。 */
  createdAt: string;
}

/** 产物视图。 */
export interface ArtifactView {
  /** 产物主键。 */
  id: string;
  /** 类型。 */
  kind: string;
  /** 版本。 */
  version: number;
  /** 状态。 */
  status: string;
  /** 负载。 */
  payload: unknown;
  /** 创建时间。 */
  createdAt: string;
}

/** 派发视图。 */
export interface AssignmentView {
  /** 派发主键。 */
  id: string;
  /** 状态。 */
  status: string;
  /** 尝试序号。 */
  attempt: number;
  /** 执行器运行标识。 */
  executorRunId?: string;
  /** 开始时间。 */
  startedAt?: string;
  /** 结束时间。 */
  endedAt?: string;
  /** 错误。 */
  error?: string;
}

/** 工单详情视图。 */
export interface TicketDetailView {
  /** 工单。 */
  ticket: TicketView;
  /** 授权。 */
  mandate?: MandateView;
  /** 产物。 */
  artifacts: ArtifactView[];
  /** 未关闭关注。 */
  attentions: AttentionView[];
  /** 派发记录。 */
  assignments: AssignmentView[];
}

/** 工单 → 视图。 */
export function toTicketView(
  ticket: Ticket,
  openAttentions: Attention[] = [],
): TicketView {
  const waiting = [...openAttentions].sort(
    (left, right) => left.deadline.getTime() - right.deadline.getTime(),
  );
  const nearest = waiting[0] ?? null;
  return {
    id: ticket.id,
    mandateId: ticket.mandateId,
    threadId: ticket.threadId,
    ...(ticket.scopeKey !== null ? { scopeKey: ticket.scopeKey } : {}),
    kind: ticket.kind,
    status: ticket.status,
    openedAt: ticket.openedAt.toISOString(),
    ...(ticket.endedAt ? { endedAt: ticket.endedAt.toISOString() } : {}),
    ...(ticket.endReason ? { endReason: ticket.endReason } : {}),
    ...(nearest?.assignee ? { assignee: nearest.assignee } : {}),
    ...(nearest?.deadline ? { deadline: nearest.deadline.toISOString() } : {}),
    overdue: nearest?.deadline
      ? nearest.deadline.getTime() < Date.now()
      : false,
    waitingCount: waiting.length,
  };
}

/** 关注 → 视图。 */
export function toAttentionView(attention: Attention): AttentionView {
  return {
    id: attention.id,
    ticketId: attention.ticketId,
    kind: attention.kind,
    question: attention.question,
    status: attention.status,
    assignee: attention.assignee,
    deadline: attention.deadline.toISOString(),
    ...(attention.decidedBy ? { decidedBy: attention.decidedBy } : {}),
    ...(attention.decidedAt
      ? { decidedAt: attention.decidedAt.toISOString() }
      : {}),
    answer: attention.answer,
  };
}

/** 授权 → 视图。 */
export function toMandateView(mandate: Mandate): MandateView {
  return {
    id: mandate.id,
    policyId: mandate.policyId,
    policyVersion: mandate.policyVersion,
    strength: mandate.strength,
    scope: mandate.scope,
    actorId: mandate.actorId,
    createdAt: mandate.createdAt.toISOString(),
  };
}

/** 产物 → 视图。 */
export function toArtifactView(artifact: Artifact): ArtifactView {
  return {
    id: artifact.id,
    kind: artifact.kind,
    version: artifact.version,
    status: artifact.status,
    payload: artifact.payload,
    createdAt: artifact.createdAt.toISOString(),
  };
}

/** 派发 → 视图。 */
export function toAssignmentView(assignment: Assignment): AssignmentView {
  return {
    id: assignment.id,
    status: assignment.status,
    attempt: assignment.attempt,
    ...(assignment.executorRunId
      ? { executorRunId: assignment.executorRunId }
      : {}),
    ...(assignment.startedAt
      ? { startedAt: assignment.startedAt.toISOString() }
      : {}),
    ...(assignment.endedAt
      ? { endedAt: assignment.endedAt.toISOString() }
      : {}),
    ...(assignment.error ? { error: assignment.error } : {}),
  };
}

/** 线程视图。 */
export interface ThreadView {
  /** 线程主键。 */
  id: string;
  /** 来源类型。 */
  sourceType: string;
  /** 来源内线程键。 */
  externalKey: string;
  /** 状态。 */
  status: string;
  /** 摘要。 */
  summary?: string;
  /** 摘要版本。 */
  summaryVersion: number;
  /** 最近事件时间。 */
  lastEventAt?: string;
  /** 创建时间。 */
  createdAt: string;
}

/** 事件视图。 */
export interface TriggerView {
  /** 事件主键。 */
  id: string;
  /** 操作者。 */
  actorId: string;
  /** 文本。 */
  text: string;
  /** 点名方式。 */
  addressed?: string;
  /** 处置状态。 */
  disposition: string;
  /** 来源类型（逐事件标注）。 */
  sourceType: string;
  /** 过滤原因；仅 filtered 时有值。 */
  filterReason?: string;
  /** 发生时间。 */
  occurredAt: string;
}

/** 冲突视图。 */
export interface ConflictView {
  /** 冲突类型。 */
  kind: string;
  /** 触发事件主键。 */
  triggerId: string;
  /** 关联工单主键。 */
  ticketId: string;
  /** 证据摘要。 */
  excerpt: string;
}

/** 线程详情视图。 */
export interface ThreadDetailView {
  /** 线程。 */
  thread: ThreadView;
  /** 事件时间线。 */
  triggers: TriggerView[];
  /** 线程工单。 */
  tickets: TicketView[];
  /** 显式冲突标记。 */
  conflicts: ConflictView[];
}

/** 冲突 → 视图。 */
export function toConflictView(conflict: Conflict): ConflictView {
  return {
    kind: conflict.kind,
    triggerId: conflict.triggerId,
    ticketId: conflict.ticketId,
    excerpt: conflict.excerpt,
  };
}

/** 线程 → 视图。 */
export function toThreadView(thread: Thread): ThreadView {
  return {
    id: thread.id,
    sourceType: thread.sourceType,
    externalKey: thread.externalKey,
    status: thread.status,
    ...(thread.summary ? { summary: thread.summary } : {}),
    summaryVersion: thread.summaryVersion,
    ...(thread.lastEventAt
      ? { lastEventAt: thread.lastEventAt.toISOString() }
      : {}),
    createdAt: thread.createdAt.toISOString(),
  };
}

/** 线程事件与工单 → 冲突视图。 */
export function detectThreadConflicts(
  triggers: Parameters<typeof toTriggerView>[0][],
  tickets: Parameters<typeof toTicketView>[0][],
): ConflictView[] {
  return detectConflicts(triggers, tickets).map(toConflictView);
}

/** 事件 → 视图。 */
export function toTriggerView(trigger: Trigger): TriggerView {
  return {
    id: trigger.id,
    actorId: trigger.actorId,
    text: trigger.text,
    ...(trigger.addressed ? { addressed: trigger.addressed } : {}),
    disposition: trigger.disposition,
    sourceType: trigger.sourceType,
    ...(trigger.filterReason ? { filterReason: trigger.filterReason } : {}),
    occurredAt: trigger.occurredAt.toISOString(),
  };
}
