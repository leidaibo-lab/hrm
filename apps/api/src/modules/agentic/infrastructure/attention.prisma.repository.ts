import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma';
import {
  Prisma,
  AttentionKind as PrismaAttentionKind,
  AttentionStatus as PrismaAttentionStatus,
} from '../../../platform/prisma/generated/client';
import type { Attention } from '../domain/attention.entity';
import type { AttentionRepository } from '../domain/attention.repository';
import { toAttentionDomain } from './attention.mapper';

/** AttentionRepository 的 Prisma 实现：只更新决定相关列。 */
@Injectable()
export class AttentionPrismaRepository implements AttentionRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** 按主键查找。 */
  async findById(id: string): Promise<Attention | null> {
    const row = await this.prisma.attention.findUnique({ where: { id } });
    return row ? toAttentionDomain(row) : null;
  }

  /** 列出工单的待答关注。 */
  async listOpenByTicket(ticketId: string): Promise<Attention[]> {
    const rows = await this.prisma.attention.findMany({
      where: { ticketId, status: 'open' },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => toAttentionDomain(row));
  }

  /** 列出全部待答关注。 */
  async listOpen(limit: number): Promise<Attention[]> {
    const rows = await this.prisma.attention.findMany({
      where: { status: 'open' },
      orderBy: [{ deadline: 'asc' }, { createdAt: 'asc' }],
      take: limit,
    });
    return rows.map((row) => toAttentionDomain(row));
  }

  /** 列出工单的全部关注。 */
  async listByTicket(ticketId: string): Promise<Attention[]> {
    const rows = await this.prisma.attention.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => toAttentionDomain(row));
  }

  /** 保存关注。 */
  async save(attention: Attention): Promise<void> {
    const snapshot = attention.toSnapshot();
    await this.prisma.attention.upsert({
      where: { id: snapshot.id },
      create: {
        id: snapshot.id,
        ticketId: snapshot.ticketId,
        kind: snapshot.kind as PrismaAttentionKind,
        question: snapshot.question,
        options:
          snapshot.options === null
            ? Prisma.DbNull
            : (snapshot.options as Prisma.InputJsonValue),
        status: snapshot.status as PrismaAttentionStatus,
        deadline: snapshot.deadline,
        assignee: snapshot.assignee,
        decidedBy: snapshot.decidedBy,
        decidedAt: snapshot.decidedAt,
        answer:
          snapshot.answer === null || snapshot.answer === undefined
            ? Prisma.DbNull
            : (snapshot.answer as Prisma.InputJsonValue),
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.updatedAt,
      },
      update: {
        status: snapshot.status as PrismaAttentionStatus,
        decidedBy: snapshot.decidedBy,
        decidedAt: snapshot.decidedAt,
        answer:
          snapshot.answer === null || snapshot.answer === undefined
            ? Prisma.DbNull
            : (snapshot.answer as Prisma.InputJsonValue),
        updatedAt: snapshot.updatedAt,
      },
    });
  }
}
