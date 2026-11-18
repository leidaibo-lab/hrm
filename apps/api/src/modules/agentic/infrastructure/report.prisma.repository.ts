import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma';
import {
  Prisma,
  ReportKind as PrismaReportKind,
} from '../../../platform/prisma/generated/client';
import type { Report } from '../domain/report.entity';
import type { ReportRepository } from '../domain/report.repository';
import { toReportDomain } from './report.mapper';

/** ReportRepository 的 Prisma 实现：只追加。 */
@Injectable()
export class ReportPrismaRepository implements ReportRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** 按主键查找。 */
  async findById(id: string): Promise<Report | null> {
    const row = await this.prisma.report.findUnique({ where: { id } });
    return row ? toReportDomain(row) : null;
  }

  /** 列出派发的回报。 */
  async listByAssignment(assignmentId: string): Promise<Report[]> {
    const rows = await this.prisma.report.findMany({
      where: { assignmentId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => toReportDomain(row));
  }

  /** 追加回报。 */
  async create(report: Report): Promise<void> {
    const snapshot = report.toSnapshot();
    await this.prisma.report.create({
      data: {
        id: snapshot.id,
        assignmentId: snapshot.assignmentId,
        kind: snapshot.kind as PrismaReportKind,
        payload: snapshot.payload as Prisma.InputJsonValue,
        createdAt: snapshot.createdAt,
      },
    });
  }
}
