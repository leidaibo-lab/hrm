import type { Policy as PolicyRow } from '../../../platform/prisma/generated/client';
import type { MandateStrength } from '../domain/mandate.entity';
import { Policy } from '../domain/policy.entity';

/** Prisma 行 → 策略聚合；domain ← 持久化形态的唯一翻译点。 */
export function toPolicyDomain(row: PolicyRow): Policy {
  return Policy.rehydrate({
    id: row.id,
    version: row.version,
    acceptMode: row.acceptMode as MandateStrength,
    rules: row.rules,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  });
}
