import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma';
import {
  TicketKind as PrismaTicketKind,
  TicketStatus as PrismaTicketStatus,
} from '../../../platform/prisma/generated/client';
import type { Ticket } from '../domain/ticket.entity';
import type { TicketRepository } from '../domain/ticket.repository';
import { toTicketDomain } from './ticket.mapper';

/** TicketRepository 的 Prisma 实现：只更新状态相关列。 */
@Injectable()
export class TicketPrismaRepository implements TicketRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** 按主键查找。 */
  async findById(id: string): Promise<Ticket | null> {
    const row = await this.prisma.ticket.findUnique({ where: { id } });
    return row ? toTicketDomain(row) : null;
  }

  /** 按授权查找。 */
  async findByMandateId(mandateId: string): Promise<Ticket | null> {
    const row = await this.prisma.ticket.findUnique({ where: { mandateId } });
    return row ? toTicketDomain(row) : null;
  }

  /** 按条件列出工单。 */
  async list(filter: {
    status?: 'open' | 'ended';
    scopeKey?: string;
    scopeKeys?: string[];
    limit?: number;
  }): Promise<Ticket[]> {
    const scoped =
      filter.scopeKeys === undefined
        ? {}
        : {
            OR: [{ scopeKey: { in: filter.scopeKeys } }, { scopeKey: null }],
          };
    const rows = await this.prisma.ticket.findMany({
      where: {
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.scopeKey ? { scopeKey: filter.scopeKey } : {}),
        ...scoped,
      },
      orderBy: { openedAt: 'desc' },
      take: filter.limit ?? 50,
    });
    return rows.map((row) => toTicketDomain(row));
  }

  /** 列出线程上的工单。 */
  async listByThread(threadId: string): Promise<Ticket[]> {
    const rows = await this.prisma.ticket.findMany({
      where: { threadId },
      orderBy: { openedAt: 'asc' },
    });
    return rows.map((row) => toTicketDomain(row));
  }

  /** 保存工单：不存在则创建，存在则只更新状态列。 */
  async save(ticket: Ticket): Promise<void> {
    const snapshot = ticket.toSnapshot();
    await this.prisma.ticket.upsert({
      where: { id: snapshot.id },
      create: {
        id: snapshot.id,
        mandateId: snapshot.mandateId,
        threadId: snapshot.threadId,
        scopeKey: snapshot.scopeKey,
        kind: snapshot.kind as PrismaTicketKind,
        status: snapshot.status as PrismaTicketStatus,
        openedAt: snapshot.openedAt,
        endedAt: snapshot.endedAt,
        endReason: snapshot.endReason,
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.updatedAt,
      },
      update: {
        status: snapshot.status as PrismaTicketStatus,
        endedAt: snapshot.endedAt,
        endReason: snapshot.endReason,
        updatedAt: snapshot.updatedAt,
      },
    });
  }
}
