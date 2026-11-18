import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma';
import {
  Prisma,
  Addressed as PrismaAddressed,
  Disposition as PrismaDisposition,
  SourceType as PrismaSourceType,
} from '../../../platform/prisma/generated/client';
import type { Trigger } from '../domain/trigger.entity';
import type { TriggerRepository } from '../domain/trigger.repository';
import { toTriggerDomain } from './trigger.mapper';

/** TriggerRepository 的 Prisma 实现：创建不覆盖，处置只更新两列。 */
@Injectable()
export class TriggerPrismaRepository implements TriggerRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** 按幂等键查找。 */
  async findByDedupeKey(dedupeKey: string): Promise<Trigger | null> {
    const row = await this.prisma.trigger.findUnique({ where: { dedupeKey } });
    return row ? toTriggerDomain(row) : null;
  }

  /** 创建事件；唯一键冲突返回 false。 */
  async create(trigger: Trigger): Promise<boolean> {
    const snapshot = trigger.toSnapshot();
    try {
      await this.prisma.trigger.create({
        data: {
          id: snapshot.id,
          dedupeKey: snapshot.dedupeKey,
          sourceType: snapshot.sourceType as PrismaSourceType,
          instanceId: snapshot.instanceId,
          threadId: snapshot.threadId,
          scopeKey: snapshot.scopeKey,
          actorId: snapshot.actorId,
          actorUserId: snapshot.actorUserId,
          addressed: snapshot.addressed as PrismaAddressed | null,
          text: snapshot.text,
          payload: snapshot.payload as Prisma.InputJsonValue,
          payloadVersion: snapshot.payloadVersion,
          occurredAt: snapshot.occurredAt,
          receivedAt: snapshot.receivedAt,
          disposition: snapshot.disposition as PrismaDisposition,
          disposedAt: snapshot.disposedAt,
        },
      });
      return true;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        return false;
      throw error;
    }
  }

  /** 列出线程事件。 */
  async listByThread(threadId: string, limit = 200): Promise<Trigger[]> {
    const rows = await this.prisma.trigger.findMany({
      where: { threadId },
      orderBy: { occurredAt: 'asc' },
      take: limit,
    });
    return rows.map((row) => toTriggerDomain(row));
  }

  /** 按主键批量取事件。 */
  async listByIds(ids: string[]): Promise<Trigger[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.trigger.findMany({
      where: { id: { in: ids } },
    });
    return rows.map((row) => toTriggerDomain(row));
  }

  /** 只更新处置状态与处置时间。 */
  async saveDisposition(trigger: Trigger): Promise<void> {
    const snapshot = trigger.toSnapshot();
    await this.prisma.trigger.update({
      where: { id: snapshot.id },
      data: {
        disposition: snapshot.disposition as PrismaDisposition,
        disposedAt: snapshot.disposedAt,
        filterReason: snapshot.filterReason,
      },
    });
  }
}
