import type { SourceAuthorization as SourceAuthorizationRow } from '../../../platform/prisma/generated/client';
import { SourceAuthorization } from '../domain/source-authorization.entity';

/** Prisma 行 → 来源授权。 */
export function toSourceAuthorizationDomain(
  row: SourceAuthorizationRow,
): SourceAuthorization {
  return SourceAuthorization.rehydrate({
    id: row.id,
    sourceInstanceId: row.sourceInstanceId,
    scopeKey: row.scopeKey,
    authorizedBy: row.authorizedBy,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
  });
}
