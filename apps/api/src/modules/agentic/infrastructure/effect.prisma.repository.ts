import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma';
import {
  Prisma,
  EffectKind as PrismaEffectKind,
  EffectStatus as PrismaEffectStatus,
} from '../../../platform/prisma/generated/client';
import type { Effect } from '../domain/effect.entity';
import type { EffectRepository } from '../domain/effect.repository';
import { toEffectDomain } from './effect.mapper';

/** EffectRepository 的 Prisma 实现：幂等键唯一，结果可空。 */
@Injectable()
export class EffectPrismaRepository implements EffectRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** 按幂等键查找。 */
  async findByIdempotencyKey(idempotencyKey: string): Promise<Effect | null> {
    const row = await this.prisma.effect.findUnique({
      where: { idempotencyKey },
    });
    return row ? toEffectDomain(row) : null;
  }

  /** 创建副作用；唯一冲突返回 false。 */
  async create(effect: Effect): Promise<boolean> {
    const snapshot = effect.toSnapshot();
    try {
      await this.prisma.effect.create({
        data: {
          id: snapshot.id,
          idempotencyKey: snapshot.idempotencyKey,
          kind: snapshot.kind as PrismaEffectKind,
          target: snapshot.target,
          status: snapshot.status as PrismaEffectStatus,
          result:
            snapshot.result === null || snapshot.result === undefined
              ? Prisma.DbNull
              : (snapshot.result as Prisma.InputJsonValue),
          createdAt: snapshot.createdAt,
          completedAt: snapshot.completedAt,
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

  /** 列出早于阈值且仍 pending 的副作用。 */
  async listPendingBefore(cutoff: Date, limit: number): Promise<Effect[]> {
    const rows = await this.prisma.effect.findMany({
      where: { status: 'pending', createdAt: { lt: cutoff } },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    return rows.map((row) => toEffectDomain(row));
  }

  /** 保存状态与结果。 */
  async save(effect: Effect): Promise<void> {
    const snapshot = effect.toSnapshot();
    await this.prisma.effect.update({
      where: { id: snapshot.id },
      data: {
        status: snapshot.status as PrismaEffectStatus,
        result:
          snapshot.result === null || snapshot.result === undefined
            ? Prisma.DbNull
            : (snapshot.result as Prisma.InputJsonValue),
        completedAt: snapshot.completedAt,
      },
    });
  }
}
