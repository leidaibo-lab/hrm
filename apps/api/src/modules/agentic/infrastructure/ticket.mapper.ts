import type { Ticket as TicketRow } from '../../../platform/prisma/generated/client';
import type { TicketKind, TicketStatus } from '../domain/ticket.entity';
import { Ticket } from '../domain/ticket.entity';

/** Prisma 行 → 工单聚合；domain ← 持久化形态的唯一翻译点。 */
export function toTicketDomain(row: TicketRow): Ticket {
  return Ticket.rehydrate({
    id: row.id,
    mandateId: row.mandateId,
    threadId: row.threadId,
    scopeKey: row.scopeKey,
    kind: row.kind as TicketKind,
    status: row.status as TicketStatus,
    openedAt: row.openedAt,
    endedAt: row.endedAt,
    endReason: row.endReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
