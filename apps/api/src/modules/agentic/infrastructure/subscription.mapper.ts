import type { Subscription as SubscriptionRow } from '../../../platform/prisma/generated/client';
import type { SubscriptionReason } from '../domain/subscription.entity';
import { Subscription } from '../domain/subscription.entity';

/** Prisma 行 → 订阅聚合；domain ← 持久化形态的唯一翻译点。 */
export function toSubscriptionDomain(row: SubscriptionRow): Subscription {
  return Subscription.rehydrate({
    ticketId: row.ticketId,
    threadId: row.threadId,
    reason: row.reason as SubscriptionReason,
    createdAt: row.createdAt,
  });
}
