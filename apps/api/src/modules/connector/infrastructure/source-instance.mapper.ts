import type { SourceInstance as SourceInstanceRow } from '../../../platform/prisma/generated/client';
import type { SourceType } from '../domain/source-adapter.port';
import { SourceInstance } from '../domain/source-instance.entity';

/** Prisma 行 → 来源实例聚合；domain ← 持久化形态的唯一翻译点。 */
export function toSourceInstanceDomain(row: SourceInstanceRow): SourceInstance {
  return SourceInstance.rehydrate({
    id: row.id,
    sourceType: row.sourceType as SourceType,
    name: row.name,
    config: row.config,
    botId: row.botId,
    enabled: row.enabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
