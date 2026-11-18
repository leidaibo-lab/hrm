import type { Trigger as TriggerRow } from '../../../platform/prisma/generated/client';
import type { Addressed, TriggerDisposition } from '../domain/trigger.entity';
import { Trigger } from '../domain/trigger.entity';

/** Prisma 行 → 事件聚合；domain ← 持久化形态的唯一翻译点。 */
export function toTriggerDomain(row: TriggerRow): Trigger {
  return Trigger.rehydrate({
    id: row.id,
    dedupeKey: row.dedupeKey,
    sourceType: row.sourceType,
    instanceId: row.instanceId,
    threadId: row.threadId,
    scopeKey: row.scopeKey,
    actorId: row.actorId,
    actorUserId: row.actorUserId,
    addressed: row.addressed as Addressed | null,
    text: row.text,
    payload: row.payload,
    payloadVersion: row.payloadVersion,
    occurredAt: row.occurredAt,
    receivedAt: row.receivedAt,
    disposition: row.disposition as TriggerDisposition,
    disposedAt: row.disposedAt,
    filterReason: row.filterReason,
  });
}
