import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma';
import { AssignmentStatus as PrismaAssignmentStatus } from '../../../platform/prisma/generated/client';
import type { Assignment } from '../domain/assignment.entity';
import type { AssignmentRepository } from '../domain/assignment.repository';
import { toAssignmentDomain } from './assignment.mapper';

/** AssignmentRepository 的 Prisma 实现：只更新运行状态列。 */
@Injectable()
export class AssignmentPrismaRepository implements AssignmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** 按主键查找。 */
  async findById(id: string): Promise<Assignment | null> {
    const row = await this.prisma.assignment.findUnique({ where: { id } });
    return row ? toAssignmentDomain(row) : null;
  }

  /** 列出工单的派发。 */
  async listByTicket(ticketId: string): Promise<Assignment[]> {
    const rows = await this.prisma.assignment.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => toAssignmentDomain(row));
  }

  /** 工单当前未结束的派发。 */
  async findActiveByTicket(ticketId: string): Promise<Assignment | null> {
    const row = await this.prisma.assignment.findFirst({
      where: { ticketId, status: { in: ['pending', 'running'] } },
      orderBy: { createdAt: 'desc' },
    });
    return row ? toAssignmentDomain(row) : null;
  }

  /** 保存派发。 */
  async save(assignment: Assignment): Promise<void> {
    const snapshot = assignment.toSnapshot();
    await this.prisma.assignment.upsert({
      where: { id: snapshot.id },
      create: {
        id: snapshot.id,
        ticketId: snapshot.ticketId,
        status: snapshot.status as PrismaAssignmentStatus,
        attempt: snapshot.attempt,
        executorRunId: snapshot.executorRunId,
        startedAt: snapshot.startedAt,
        endedAt: snapshot.endedAt,
        error: snapshot.error,
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.updatedAt,
      },
      update: {
        status: snapshot.status as PrismaAssignmentStatus,
        executorRunId: snapshot.executorRunId,
        startedAt: snapshot.startedAt,
        endedAt: snapshot.endedAt,
        error: snapshot.error,
        updatedAt: snapshot.updatedAt,
      },
    });
  }
}
