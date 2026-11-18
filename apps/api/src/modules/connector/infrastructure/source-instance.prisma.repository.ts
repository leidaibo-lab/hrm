import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma';
import {
  Prisma,
  SourceType as PrismaSourceType,
} from '../../../platform/prisma/generated/client';
import { SourceNameConflictError } from '../domain/connector.error';
import type { SourceType } from '../domain/source-adapter.port';
import type { SourceInstance } from '../domain/source-instance.entity';
import type { SourceInstanceRepository } from '../domain/source-instance.repository';
import { toSourceInstanceDomain } from './source-instance.mapper';

/** SourceInstanceRepository 的 Prisma 实现：只更新可变字段。 */
@Injectable()
export class SourceInstancePrismaRepository
  implements SourceInstanceRepository
{
  constructor(private readonly prisma: PrismaService) {}

  /** 按主键查找。 */
  async findById(id: string): Promise<SourceInstance | null> {
    const row = await this.prisma.sourceInstance.findUnique({ where: { id } });
    return row ? toSourceInstanceDomain(row) : null;
  }

  /** 按类型与名称查找。 */
  async findByTypeAndName(
    sourceType: SourceType,
    name: string,
  ): Promise<SourceInstance | null> {
    const row = await this.prisma.sourceInstance.findUnique({
      where: {
        sourceType_name: {
          sourceType: sourceType as PrismaSourceType,
          name,
        },
      },
    });
    return row ? toSourceInstanceDomain(row) : null;
  }

  /** 列出实例。 */
  async list(limit = 50): Promise<SourceInstance[]> {
    const rows = await this.prisma.sourceInstance.findMany({
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    return rows.map((row) => toSourceInstanceDomain(row));
  }

  /** 保存实例：不存在则创建，存在则只更新配置与启停。 */
  async save(instance: SourceInstance): Promise<void> {
    const snapshot = instance.toSnapshot();
    try {
      await this.saveUpsert(snapshot);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new SourceNameConflictError(snapshot.name);
      throw error;
    }
  }

  private async saveUpsert(
    snapshot: ReturnType<SourceInstance['toSnapshot']>,
  ): Promise<void> {
    await this.prisma.sourceInstance.upsert({
      where: { id: snapshot.id },
      create: {
        id: snapshot.id,
        sourceType: snapshot.sourceType as PrismaSourceType,
        name: snapshot.name,
        config: snapshot.config as Prisma.InputJsonValue,
        botId: snapshot.botId,
        enabled: snapshot.enabled,
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.updatedAt,
      },
      update: {
        name: snapshot.name,
        config: snapshot.config as Prisma.InputJsonValue,
        botId: snapshot.botId,
        enabled: snapshot.enabled,
        updatedAt: snapshot.updatedAt,
      },
    });
  }
}
