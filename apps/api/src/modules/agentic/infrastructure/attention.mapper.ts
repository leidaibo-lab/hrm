import type { Attention as AttentionRow } from '../../../platform/prisma/generated/client';
import type {
  AttentionKind,
  AttentionStatus,
} from '../domain/attention.entity';
import { Attention } from '../domain/attention.entity';

/** Prisma 行 → 关注聚合；domain ← 持久化形态的唯一翻译点。 */
export function toAttentionDomain(row: AttentionRow): Attention {
  return Attention.rehydrate({
    id: row.id,
    ticketId: row.ticketId,
    kind: row.kind as AttentionKind,
    question: row.question,
    options: row.options as unknown[] | null,
    status: row.status as AttentionStatus,
    deadline: row.deadline,
    assignee: row.assignee,
    decidedBy: row.decidedBy,
    decidedAt: row.decidedAt,
    answer: row.answer,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
