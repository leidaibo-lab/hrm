import type { ScopeMembership as ScopeMembershipRow } from '../../../platform/prisma/generated/client';
import { ScopeMembership } from '../domain/scope-membership.entity';

/** Prisma 行 → 数据范围成员。 */
export function toScopeMembershipDomain(
  row: ScopeMembershipRow,
): ScopeMembership {
  return ScopeMembership.rehydrate({
    id: row.id,
    userId: row.userId,
    scopeKey: row.scopeKey,
    createdAt: row.createdAt,
  });
}
