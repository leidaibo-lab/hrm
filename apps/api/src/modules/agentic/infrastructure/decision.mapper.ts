import type { Decision as DecisionRow } from '../../../platform/prisma/generated/client';
import type { DecisionKind } from '../domain/decision.entity';
import { Decision } from '../domain/decision.entity';
import type { MandateStrength } from '../domain/mandate.entity';

/** 结论行及其事件关联。 */
type DecisionRowWithTriggers = DecisionRow & {
  /** 关联的事件主键。 */
  triggers: Array<{ triggerId: string }>;
};

/** Prisma 行 → 结论聚合；domain ← 持久化形态的唯一翻译点。 */
export function toDecisionDomain(row: DecisionRowWithTriggers): Decision {
  return Decision.rehydrate({
    id: row.id,
    threadId: row.threadId,
    kind: row.kind as DecisionKind,
    strength: row.strength as MandateStrength,
    scope: row.scope,
    matchedRuleIds: row.matchedRuleIds as string[] | null,
    policyId: row.policyId,
    policyVersion: row.policyVersion,
    reason: row.reason,
    triggerIds: row.triggers.map((link) => link.triggerId),
    createdAt: row.createdAt,
  });
}
