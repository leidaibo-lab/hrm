import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma';
import { SubscriptionReason as PrismaSubscriptionReason } from '../../../platform/prisma/generated/client';
import type { Subscription } from '../domain/subscription.entity';
import type { SubscriptionRepository } from '../domain/subscription.repository';
import { toSubscriptionDomain } from './subscription.mapper';

/** SubscriptionRepository 的 Prisma 实现：联合主键防重复。 */
@Injectable()
export class SubscriptionPrismaRepository implements SubscriptionRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** 列出线程上的全部订阅。 */
  async listByThread(threadId: string): Promise<Subscription[]> {
    const rows = await this.prisma.subscription.findMany({
      where: { threadId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => toSubscriptionDomain(row));
  }

  /** 列出工单的全部订阅。 */
  async listByTicket(ticketId: string): Promise<Subscription[]> {
    const rows = await this.prisma.subscription.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => toSubscriptionDomain(row));
  }

  /** 新增订阅。 */
  async add(subscription: Subscription): Promise<void> {
    const snapshot = subscription.toSnapshot();
    await this.prisma.subscription.create({
      data: {
        ticketId: snapshot.ticketId,
        threadId: snapshot.threadId,
        reason: snapshot.reason as PrismaSubscriptionReason,
        createdAt: snapshot.createdAt,
      },
    });
  }

  /** 撤销订阅。 */
  async remove(ticketId: string, threadId: string): Promise<void> {
    await this.prisma.subscription.delete({
      where: { ticketId_threadId: { ticketId, threadId } },
    });
  }
}
