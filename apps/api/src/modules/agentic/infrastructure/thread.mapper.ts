import type { Thread as ThreadRow } from '../../../platform/prisma/generated/client';
import type { ThreadStatus } from '../domain/thread.entity';
import { Thread } from '../domain/thread.entity';

/** Prisma 行 → 线程聚合；domain ← 持久化形态的唯一翻译点。 */
export function toThreadDomain(row: ThreadRow): Thread {
  return Thread.rehydrate({
    id: row.id,
    sourceType: row.sourceType,
    externalKey: row.externalKey,
    scopeKey: row.scopeKey,
    status: row.status as ThreadStatus,
    summary: row.summary,
    summaryVersion: row.summaryVersion,
    lastEventAt: row.lastEventAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
