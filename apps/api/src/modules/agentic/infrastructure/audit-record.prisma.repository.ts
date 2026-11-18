import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma';
import { Prisma } from '../../../platform/prisma/generated/client';
import type {
  AuditRecord,
  CreateAuditRecordInput,
} from '../domain/audit-record.entity';
import type { AuditRecordRepository } from '../domain/audit-record.repository';

/** 审计记录仓储：只读 AuditLog。 */
@Injectable()
export class AuditRecordPrismaRepository implements AuditRecordRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** 追加一条审计记录。 */
  async append(input: CreateAuditRecordInput): Promise<AuditRecord> {
    const id = randomUUID();
    const row = await this.prisma.auditLog.create({
      data: {
        id,
        traceId: input.traceId,
        actorId: input.actorId,
        action: input.action,
        method: input.method,
        path: input.path,
        statusCode: input.statusCode,
        detail:
          input.detail === null
            ? Prisma.DbNull
            : (input.detail as Prisma.InputJsonValue),
        createdAt: input.now ?? new Date(),
      },
    });
    return {
      id: row.id,
      traceId: row.traceId,
      actorId: row.actorId,
      action: row.action,
      method: row.method,
      path: row.path,
      statusCode: row.statusCode,
      detail: row.detail,
      createdAt: row.createdAt,
    };
  }

  /** 按动作/操作者过滤。 */
  async list(filter: {
    action?: string;
    actorId?: string;
    traceId?: string;
    offset?: number;
    limit?: number;
  }): Promise<AuditRecord[]> {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        ...(filter.action ? { action: filter.action } : {}),
        ...(filter.actorId ? { actorId: filter.actorId } : {}),
        ...(filter.traceId ? { traceId: filter.traceId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      skip: filter.offset ?? 0,
      take: filter.limit ?? 50,
    });
    return rows.map((row) => ({
      id: row.id,
      traceId: row.traceId,
      actorId: row.actorId,
      action: row.action,
      method: row.method,
      path: row.path,
      statusCode: row.statusCode,
      detail: row.detail,
      createdAt: row.createdAt,
    }));
  }
}
