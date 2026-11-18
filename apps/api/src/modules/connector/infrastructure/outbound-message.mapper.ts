import type { OutboundMessage as OutboundMessageRow } from '../../../platform/prisma/generated/client';
import type { OutboundStatus } from '../domain/outbound-message.entity';
import { OutboundMessage } from '../domain/outbound-message.entity';

/** Prisma 行 → 出站消息聚合；domain ← 持久化形态的唯一翻译点。 */
export function toOutboundMessageDomain(
  row: OutboundMessageRow,
): OutboundMessage {
  return OutboundMessage.rehydrate({
    id: row.id,
    instanceId: row.instanceId,
    targetId: row.targetId,
    address: row.address,
    payload: row.payload,
    idempotencyKey: row.idempotencyKey,
    status: row.status as OutboundStatus,
    attempts: row.attempts,
    nextAttemptAt: row.nextAttemptAt,
    sentAt: row.sentAt,
    error: row.error,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
