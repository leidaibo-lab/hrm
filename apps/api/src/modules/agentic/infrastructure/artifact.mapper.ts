import type { Artifact as ArtifactRow } from '../../../platform/prisma/generated/client';
import type { ArtifactKind, ArtifactStatus } from '../domain/artifact.entity';
import { Artifact } from '../domain/artifact.entity';

/** Prisma 行 → 产物聚合；domain ← 持久化形态的唯一翻译点。 */
export function toArtifactDomain(row: ArtifactRow): Artifact {
  return Artifact.rehydrate({
    id: row.id,
    ticketId: row.ticketId,
    kind: row.kind as ArtifactKind,
    version: row.version,
    payload: row.payload,
    status: row.status as ArtifactStatus,
    assignmentId: row.assignmentId,
    createdAt: row.createdAt,
  });
}
