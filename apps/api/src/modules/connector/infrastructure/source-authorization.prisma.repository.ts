import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma';
import type { SourceAuthorization } from '../domain/source-authorization.entity';
import type { SourceAuthorizationRepository } from '../domain/source-authorization.repository';
import { toSourceAuthorizationDomain } from './source-authorization.mapper';

/** 来源授权仓储的 Prisma 实现。 */
@Injectable()
export class SourceAuthorizationPrismaRepository
  implements SourceAuthorizationRepository
{
  constructor(private readonly prisma: PrismaService) {}

  /** 按来源实例与范围查找。 */
  async findByInstanceAndScope(
    sourceInstanceId: string,
    scopeKey: string,
  ): Promise<SourceAuthorization | null> {
    const row = await this.prisma.sourceAuthorization.findUnique({
      where: {
        sourceInstanceId_scopeKey: { sourceInstanceId, scopeKey },
      },
    });
    return row ? toSourceAuthorizationDomain(row) : null;
  }

  /** 列出实例授权。 */
  async listByInstance(
    sourceInstanceId: string,
  ): Promise<SourceAuthorization[]> {
    const rows = await this.prisma.sourceAuthorization.findMany({
      where: { sourceInstanceId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => toSourceAuthorizationDomain(row));
  }

  /** 保存授权。 */
  async save(authorization: SourceAuthorization): Promise<void> {
    const snapshot = authorization.toSnapshot();
    await this.prisma.sourceAuthorization.upsert({
      where: {
        sourceInstanceId_scopeKey: {
          sourceInstanceId: snapshot.sourceInstanceId,
          scopeKey: snapshot.scopeKey,
        },
      },
      create: {
        id: snapshot.id,
        sourceInstanceId: snapshot.sourceInstanceId,
        scopeKey: snapshot.scopeKey,
        authorizedBy: snapshot.authorizedBy,
        expiresAt: snapshot.expiresAt,
        revokedAt: snapshot.revokedAt,
        createdAt: snapshot.createdAt,
      },
      update: {
        authorizedBy: snapshot.authorizedBy,
        expiresAt: snapshot.expiresAt,
        revokedAt: snapshot.revokedAt,
      },
    });
  }
}
