import type { Effect as EffectRow } from '../../../platform/prisma/generated/client';
import type { EffectKind, EffectStatus } from '../domain/effect.entity';
import { Effect } from '../domain/effect.entity';

/** Prisma 行 → 副作用聚合；domain ← 持久化形态的唯一翻译点。 */
export function toEffectDomain(row: EffectRow): Effect {
  return Effect.rehydrate({
    id: row.id,
    idempotencyKey: row.idempotencyKey,
    kind: row.kind as EffectKind,
    target: row.target,
    status: row.status as EffectStatus,
    result: row.result,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  });
}
