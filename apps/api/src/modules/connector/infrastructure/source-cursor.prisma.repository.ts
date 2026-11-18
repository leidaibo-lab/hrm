import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma';
import { Prisma } from '../../../platform/prisma/generated/client';
import type { SourceCursor } from '../domain/source-cursor.entity';
import type { SourceCursorRepository } from '../domain/source-cursor.repository';
import { toSourceCursorDomain } from './source-cursor.mapper';

/** SourceCursorRepository 的 Prisma 实现：按实例唯一。 */
@Injectable()
export class SourceCursorPrismaRepository implements SourceCursorRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** 按实例查找。 */
  async findByInstance(instanceId: string): Promise<SourceCursor | null> {
    const row = await this.prisma.sourceCursor.findUnique({
      where: { instanceId },
    });
    return row ? toSourceCursorDomain(row) : null;
  }

  /** 保存游标。 */
  async save(cursor: SourceCursor): Promise<void> {
    const snapshot = cursor.toSnapshot();
    await this.prisma.sourceCursor.upsert({
      where: { instanceId: snapshot.instanceId },
      create: {
        instanceId: snapshot.instanceId,
        cursor: snapshot.cursor as Prisma.InputJsonValue,
        updatedAt: snapshot.updatedAt,
      },
      update: {
        cursor: snapshot.cursor as Prisma.InputJsonValue,
        updatedAt: snapshot.updatedAt,
      },
    });
  }
}
