import type { SourceHealth as SourceHealthRow } from '../../../platform/prisma/generated/client';
import type { HealthState } from '../domain/source-health.entity';
import { SourceHealth } from '../domain/source-health.entity';

/** Prisma 行 → 健康聚合；domain ← 持久化形态的唯一翻译点。 */
export function toSourceHealthDomain(row: SourceHealthRow): SourceHealth {
  return SourceHealth.rehydrate({
    instanceId: row.instanceId,
    entry: row.entry,
    state: row.state as HealthState,
    detail: row.detail,
    checkedAt: row.checkedAt,
  });
}
