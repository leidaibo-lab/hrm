import type { Mandate as MandateRow } from '../../../platform/prisma/generated/client';
import type { MandateStrength } from '../domain/mandate.entity';
import { Mandate } from '../domain/mandate.entity';

/** Prisma 行 → 授权聚合；domain ← 持久化形态的唯一翻译点。 */
export function toMandateDomain(row: MandateRow): Mandate {
  return Mandate.rehydrate({
    id: row.id,
    policyId: row.policyId,
    policyVersion: row.policyVersion,
    strength: row.strength as MandateStrength,
    scope: row.scope,
    actorId: row.actorId,
    actorUserId: row.actorUserId,
    sourceType: row.sourceType,
    matchedRules: row.matchedRules as string[] | null,
    createdAt: row.createdAt,
  });
}
