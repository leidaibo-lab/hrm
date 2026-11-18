import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma';
import {
  SourceType as PrismaSourceType,
  ThreadStatus as PrismaThreadStatus,
} from '../../../platform/prisma/generated/client';
import { Thread } from '../domain/thread.entity';
import type { ThreadRepository } from '../domain/thread.repository';
import { toThreadDomain } from './thread.mapper';

/** ThreadRepository 的 Prisma 实现：只更新可变字段，来源与外部键不可变。 */
@Injectable()
export class ThreadPrismaRepository implements ThreadRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** 按主键查找。 */
  async findById(id: string): Promise<Thread | null> {
    const row = await this.prisma.thread.findUnique({ where: { id } });
    return row ? toThreadDomain(row) : null;
  }

  /** 按来源与外部键查找。 */
  async findByExternalKey(
    sourceType: string,
    externalKey: string,
  ): Promise<Thread | null> {
    const row = await this.prisma.thread.findUnique({
      where: {
        sourceType_externalKey: {
          sourceType: sourceType as PrismaSourceType,
          externalKey,
        },
      },
    });
    return row ? toThreadDomain(row) : null;
  }

  /** 按最近事件倒序列出线程。 */
  async list(limit = 50, scopeKeys?: string[]): Promise<Thread[]> {
    const rows = await this.prisma.thread.findMany({
      where:
        scopeKeys === undefined
          ? {}
          : {
              OR: [{ scopeKey: { in: scopeKeys } }, { scopeKey: null }],
            },
      orderBy: { lastEventAt: 'desc' },
      take: limit,
    });
    return rows.map((row) => toThreadDomain(row));
  }

  /** 保存聚合：不存在则创建，存在则只更新可变字段。 */
  async save(thread: Thread): Promise<void> {
    const snapshot = thread.toSnapshot();
    await this.prisma.thread.upsert({
      where: { id: snapshot.id },
      create: {
        id: snapshot.id,
        sourceType: snapshot.sourceType as PrismaSourceType,
        externalKey: snapshot.externalKey,
        scopeKey: snapshot.scopeKey,
        status: snapshot.status as PrismaThreadStatus,
        summary: snapshot.summary,
        summaryVersion: snapshot.summaryVersion,
        lastEventAt: snapshot.lastEventAt,
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.updatedAt,
      },
      update: {
        status: snapshot.status as PrismaThreadStatus,
        summary: snapshot.summary,
        summaryVersion: snapshot.summaryVersion,
        lastEventAt: snapshot.lastEventAt,
        updatedAt: snapshot.updatedAt,
      },
    });
  }
}
