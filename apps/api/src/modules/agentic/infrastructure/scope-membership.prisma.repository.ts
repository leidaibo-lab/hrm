import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma';
import type { ScopeMembership } from '../domain/scope-membership.entity';
import type { ScopeMembershipRepository } from '../domain/scope-membership.repository';
import { toScopeMembershipDomain } from './scope-membership.mapper';

/** 数据范围成员仓储的 Prisma 实现。 */
@Injectable()
export class ScopeMembershipPrismaRepository
  implements ScopeMembershipRepository
{
  constructor(private readonly prisma: PrismaService) {}

  /** 列出用户全部成员关系。 */
  async listByUser(userId: string): Promise<ScopeMembership[]> {
    const rows = await this.prisma.scopeMembership.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => toScopeMembershipDomain(row));
  }

  /** 列出某 scope 的全部成员关系。 */
  async listByScope(scopeKey: string): Promise<ScopeMembership[]> {
    const rows = await this.prisma.scopeMembership.findMany({
      where: { scopeKey },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => toScopeMembershipDomain(row));
  }

  /** 追加成员关系；重复关系视为已存在。 */
  async save(membership: ScopeMembership): Promise<void> {
    const snapshot = membership.toSnapshot();
    try {
      await this.prisma.scopeMembership.create({
        data: {
          id: snapshot.id,
          userId: snapshot.userId,
          scopeKey: snapshot.scopeKey,
          createdAt: snapshot.createdAt,
        },
      });
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      )
        return;
      throw error;
    }
  }

  /** 删除成员关系。 */
  async remove(userId: string, scopeKey: string): Promise<boolean> {
    const result = await this.prisma.scopeMembership.deleteMany({
      where: { userId, scopeKey },
    });
    return result.count > 0;
  }
}
