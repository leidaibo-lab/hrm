import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma';
import {
  Prisma,
  OutboundStatus as PrismaOutboundStatus,
} from '../../../platform/prisma/generated/client';
import type { OutboundMessage } from '../domain/outbound-message.entity';
import type { OutboundMessageRepository } from '../domain/outbound-message.repository';
import { toOutboundMessageDomain } from './outbound-message.mapper';

/** OutboundMessageRepository 的 Prisma 实现：按幂等键去重，按到期时间取批。 */
@Injectable()
export class OutboundMessagePrismaRepository
  implements OutboundMessageRepository
{
  constructor(private readonly prisma: PrismaService) {}

  /** 按主键查找。 */
  async findById(id: string): Promise<OutboundMessage | null> {
    const row = await this.prisma.outboundMessage.findUnique({ where: { id } });
    return row ? toOutboundMessageDomain(row) : null;
  }

  /** 按幂等键查找。 */
  async findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<OutboundMessage | null> {
    const row = await this.prisma.outboundMessage.findUnique({
      where: { idempotencyKey },
    });
    return row ? toOutboundMessageDomain(row) : null;
  }

  /** 取到期待发消息。 */
  async listDue(at: Date, limit: number): Promise<OutboundMessage[]> {
    const rows = await this.prisma.outboundMessage.findMany({
      where: {
        status: 'pending',
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: at } }],
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    return rows.map((row) => toOutboundMessageDomain(row));
  }

  /** 保存消息。 */
  async save(message: OutboundMessage): Promise<void> {
    const snapshot = message.toSnapshot();
    await this.prisma.outboundMessage.upsert({
      where: { id: snapshot.id },
      create: {
        id: snapshot.id,
        instanceId: snapshot.instanceId,
        targetId: snapshot.targetId,
        address: snapshot.address as Prisma.InputJsonValue,
        payload: snapshot.payload as Prisma.InputJsonValue,
        idempotencyKey: snapshot.idempotencyKey,
        status: snapshot.status as PrismaOutboundStatus,
        attempts: snapshot.attempts,
        nextAttemptAt: snapshot.nextAttemptAt,
        sentAt: snapshot.sentAt,
        error: snapshot.error,
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.updatedAt,
      },
      update: {
        status: snapshot.status as PrismaOutboundStatus,
        attempts: snapshot.attempts,
        nextAttemptAt: snapshot.nextAttemptAt,
        sentAt: snapshot.sentAt,
        error: snapshot.error,
        updatedAt: snapshot.updatedAt,
      },
    });
  }
}
