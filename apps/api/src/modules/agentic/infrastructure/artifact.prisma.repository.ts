import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma';
import {
  Prisma,
  ArtifactKind as PrismaArtifactKind,
  ArtifactStatus as PrismaArtifactStatus,
} from '../../../platform/prisma/generated/client';
import type { Artifact, ArtifactKind } from '../domain/artifact.entity';
import type { ArtifactRepository } from '../domain/artifact.repository';
import { toArtifactDomain } from './artifact.mapper';

/** ArtifactRepository 的 Prisma 实现：版本只增，状态可更新。 */
@Injectable()
export class ArtifactPrismaRepository implements ArtifactRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** 按主键查找。 */
  async findById(id: string): Promise<Artifact | null> {
    const row = await this.prisma.artifact.findUnique({ where: { id } });
    return row ? toArtifactDomain(row) : null;
  }

  /** 列出工单的全部产物。 */
  async listByTicket(ticketId: string): Promise<Artifact[]> {
    const rows = await this.prisma.artifact.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => toArtifactDomain(row));
  }

  /** 取某工单某类型的最新版本。 */
  async findLatest(
    ticketId: string,
    kind: ArtifactKind,
  ): Promise<Artifact | null> {
    const row = await this.prisma.artifact.findFirst({
      where: { ticketId, kind: kind as PrismaArtifactKind },
      orderBy: { version: 'desc' },
    });
    return row ? toArtifactDomain(row) : null;
  }

  /** 保存产物。 */
  async save(artifact: Artifact): Promise<void> {
    const snapshot = artifact.toSnapshot();
    await this.prisma.artifact.upsert({
      where: { id: snapshot.id },
      create: {
        id: snapshot.id,
        ticketId: snapshot.ticketId,
        kind: snapshot.kind as PrismaArtifactKind,
        version: snapshot.version,
        payload: snapshot.payload as Prisma.InputJsonValue,
        status: snapshot.status as PrismaArtifactStatus,
        assignmentId: snapshot.assignmentId,
        createdAt: snapshot.createdAt,
      },
      update: {
        status: snapshot.status as PrismaArtifactStatus,
      },
    });
  }
}
