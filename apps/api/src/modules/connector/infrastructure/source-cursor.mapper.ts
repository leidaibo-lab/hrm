import type { SourceCursor as SourceCursorRow } from '../../../platform/prisma/generated/client';
import { SourceCursor } from '../domain/source-cursor.entity';

/** Prisma 行 → 游标聚合；domain ← 持久化形态的唯一翻译点。 */
export function toSourceCursorDomain(row: SourceCursorRow): SourceCursor {
  return SourceCursor.rehydrate({
    instanceId: row.instanceId,
    cursor: row.cursor,
    updatedAt: row.updatedAt,
  });
}
