import { createHash } from 'node:crypto';
import type { Artifact } from '../../domain/artifact.entity';
import type { ArtifactRepository } from '../../domain/artifact.repository';
import type { AttentionRepository } from '../../domain/attention.repository';
import { detectConflicts } from '../../domain/conflict.entity';
import type { DecisionRepository } from '../../domain/decision.repository';
import type { Policy } from '../../domain/policy.entity';
import { readPolicyRules } from '../../domain/policy.entity';
import type { ThreadRepository } from '../../domain/thread.repository';
import type { Trigger } from '../../domain/trigger.entity';
import type { TriggerRepository } from '../../domain/trigger.repository';

/** 上下文装配依赖：全部为只读仓储。 */
export interface ContextBundleDeps {
  /** 线程仓储。 */
  threads: ThreadRepository;
  /** 事件仓储。 */
  triggers: TriggerRepository;
  /** 产物仓储。 */
  artifacts: ArtifactRepository;
  /** 结论仓储。 */
  decisions: DecisionRepository;
  /** 关注仓储。 */
  attentions: AttentionRepository;
}

/** 上下文装配输入。 */
export interface ContextBundleInput {
  /** 线程主键。 */
  threadId: string;
  /** 工单主键。 */
  ticketId: string;
  /** 本次事件批次。 */
  triggers: Trigger[];
  /** 当前策略。 */
  policy: Policy;
  /** 工单是否仍在进行中；用于冲突标记。 */
  ticketOpen?: boolean;
  /** 字符预算；缺省 24000。 */
  maxChars?: number;
}

/** 上下文装配结果。 */
export interface ContextBundleResult {
  /** 结构化上下文负载。 */
  bundle: unknown;
  /** 负载摘要（sha256）。 */
  digest: string;
  /** 是否因预算被裁剪。 */
  truncated: boolean;
}

/** 默认上下文预算（字符）。 */
const DEFAULT_MAX_CHARS = 24_000;
/** 常驻事件条数。 */
const EVENT_LIMIT = 10;
/** 常驻结论条数。 */
const DECISION_LIMIT = 5;
/** 单产物负载截断长度。 */
const PAYLOAD_LIMIT = 2_000;

/**
 * 装配线程上下文：事实链优先（线程/事件/结论/产物/关注），策略只带版本与已知键。
 * 先结构后语义；超出预算时逐级裁剪并标记 truncated，不静默丢字段。
 */
export async function buildContextBundle(
  deps: ContextBundleDeps,
  input: ContextBundleInput,
): Promise<ContextBundleResult> {
  const [thread, events, decisions, artifacts, openAttentions] =
    await Promise.all([
      deps.threads.findById(input.threadId),
      deps.triggers.listByThread(input.threadId, EVENT_LIMIT),
      deps.decisions.listByThread(input.threadId),
      deps.artifacts.listByTicket(input.ticketId),
      deps.attentions.listOpenByTicket(input.ticketId),
    ]);

  const rules = readPolicyRules(input.policy.rules);
  const bundle = {
    thread: thread
      ? {
          id: thread.id,
          sourceType: thread.sourceType,
          status: thread.status,
          summary: thread.summary,
          lastEventAt: thread.lastEventAt?.toISOString() ?? null,
        }
      : null,
    events: events.slice(-EVENT_LIMIT).map((trigger) => ({
      id: trigger.id,
      actorId: trigger.actorId,
      text: trigger.text,
      addressed: trigger.addressed,
      disposition: trigger.disposition,
      filterReason: trigger.filterReason,
      occurredAt: trigger.occurredAt.toISOString(),
    })),
    decisions: decisions.slice(-DECISION_LIMIT).map((decision) => ({
      id: decision.id,
      kind: decision.kind,
      strength: decision.strength,
      reason: decision.reason,
      matchedRuleIds: decision.matchedRuleIds,
      policyVersion: decision.policyVersion,
      createdAt: decision.createdAt.toISOString(),
    })),
    artifacts: toArtifactSummaries(artifacts),
    attentions: openAttentions.map((attention) => ({
      id: attention.id,
      kind: attention.kind,
      question: attention.question,
      assignee: attention.assignee,
      deadline: attention.deadline.toISOString(),
    })),
    policy: {
      id: input.policy.id,
      version: input.policy.version,
      rules: {
        writebackFields: rules.writebackFields,
        escalationOwner: rules.escalationOwner,
        escalationOwnerBySource: rules.escalationOwnerBySource,
        speculationEnabled: rules.speculationEnabled,
      },
    },
    conflicts: detectConflicts(
      events,
      input.ticketOpen ? [{ id: input.ticketId, isOpen: true }] : [],
    ),
    batch: input.triggers.map((trigger) => ({
      id: trigger.id,
      text: trigger.text,
      actorId: trigger.actorId,
    })),
  };

  const budget = input.maxChars ?? DEFAULT_MAX_CHARS;
  let serialized = JSON.stringify(bundle);
  let truncated = false;
  if (serialized.length > budget) {
    truncated = true;
    // 一级裁剪：事件与产物负载减半。
    bundle.events = bundle.events.slice(-Math.ceil(EVENT_LIMIT / 2));
    bundle.artifacts = bundle.artifacts.map((artifact) => ({
      ...artifact,
      payload: null,
    }));
    serialized = JSON.stringify(bundle);
  }
  if (serialized.length > budget) {
    // 二级裁剪：只保留最近事件与最新产物元信息。
    bundle.events = bundle.events.slice(-2);
    bundle.artifacts = bundle.artifacts.slice(0, 1);
    serialized = JSON.stringify(bundle);
  }

  return {
    bundle,
    digest: createHash('sha256').update(serialized).digest('hex'),
    truncated,
  };
}

/** 产物按版本倒序取最近几条，负载截断以控制上下文预算。 */
function toArtifactSummaries(artifacts: Artifact[]) {
  return [...artifacts]
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, 4)
    .map((artifact) => ({
      id: artifact.id,
      kind: artifact.kind,
      version: artifact.version,
      status: artifact.status,
      payload: toTruncatedPayload(artifact.payload),
      createdAt: artifact.createdAt.toISOString(),
    }));
}

/** 保留负载前 N 字符；非字符串负载序列化后截断。 */
function toTruncatedPayload(payload: unknown): unknown {
  const text =
    typeof payload === 'string' ? payload : JSON.stringify(payload ?? null);
  if (text.length <= PAYLOAD_LIMIT) return payload;
  return `${text.slice(0, PAYLOAD_LIMIT)}…(truncated)`;
}
