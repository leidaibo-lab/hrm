import type { Assignment as AssignmentRow } from '../../../platform/prisma/generated/client';
import type { AssignmentStatus } from '../domain/assignment.entity';
import { Assignment } from '../domain/assignment.entity';

/** Prisma 行 → 派发聚合；domain ← 持久化形态的唯一翻译点。 */
export function toAssignmentDomain(row: AssignmentRow): Assignment {
  return Assignment.rehydrate({
    id: row.id,
    ticketId: row.ticketId,
    status: row.status as AssignmentStatus,
    attempt: row.attempt,
    executorRunId: row.executorRunId,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    error: row.error,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
