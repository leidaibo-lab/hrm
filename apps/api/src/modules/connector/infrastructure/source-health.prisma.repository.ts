import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma';
import { HealthState as PrismaHealthState } from '../../../platform/prisma/generated/client';
import type { SourceHealth } from '../domain/source-health.entity';
import type { SourceHealthRepository } from '../domain/source-health.repository';
import { toSourceHealthDomain } from './source-health.mapper';

/** SourceHealthRepository 的 Prisma 实现：实例 + 条目唯一。 */
@Injectable()
export class SourceHealthPrismaRepository implements SourceHealthRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** 按实例与条目查找。 */
  async find(instanceId: string, entry: string): Promise<SourceHealth | null> {
    const row = await this.prisma.sourceHealth.findUnique({
      where: { instanceId_entry: { instanceId, entry } },
    });
    return row ? toSourceHealthDomain(row) : null;
  }

  /** 列出实例健康条目。 */
  async listByInstance(instanceId: string): Promise<SourceHealth[]> {
    const rows = await this.prisma.sourceHealth.findMany({
      where: { instanceId },
      orderBy: { entry: 'asc' },
    });
    return rows.map((row) => toSourceHealthDomain(row));
  }

  /** 保存健康记录。 */
  async save(health: SourceHealth): Promise<void> {
    const snapshot = health.toSnapshot();
    await this.prisma.sourceHealth.upsert({
      where: {
        instanceId_entry: {
          instanceId: snapshot.instanceId,
          entry: snapshot.entry,
        },
      },
      create: {
        instanceId: snapshot.instanceId,
        entry: snapshot.entry,
        state: snapshot.state as PrismaHealthState,
        detail: snapshot.detail,
        checkedAt: snapshot.checkedAt,
      },
      update: {
        state: snapshot.state as PrismaHealthState,
        detail: snapshot.detail,
        checkedAt: snapshot.checkedAt,
      },
    });
  }
}
