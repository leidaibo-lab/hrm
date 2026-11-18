import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma';
import type {
  RetentionCounts,
  RetentionCutoffs,
  RetentionRepository,
} from '../domain/retention.repository';

/** 只清理终态记录，避免删除仍待处理的事件/出站。 */
const TRIGGER_DISPOSITIONS = ['filtered', 'evaluated', 'fanned_out'] as const;
const OUTBOUND_STATUSES = ['sent', 'gone'] as const;

/** 保留归档仓储的 Prisma 实现。 */
@Injectable()
export class RetentionPrismaRepository implements RetentionRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** 统计过期记录。 */
  async countExpired(cutoffs: RetentionCutoffs): Promise<RetentionCounts> {
    const [triggers, outbound, reports] = await Promise.all([
      this.prisma.trigger.count({
        where: {
          occurredAt: { lt: cutoffs.triggerBefore },
          disposition: { in: [...TRIGGER_DISPOSITIONS] },
        },
      }),
      this.prisma.outboundMessage.count({
        where: {
          OR: [
            { sentAt: { lt: cutoffs.outboundBefore } },
            {
              status: { in: [...OUTBOUND_STATUSES] },
              createdAt: { lt: cutoffs.outboundBefore },
            },
          ],
        },
      }),
      this.prisma.report.count({
        where: { createdAt: { lt: cutoffs.reportBefore } },
      }),
    ]);
    return { triggers, outbound, reports };
  }

  /** 删除过期记录（单事务）。 */
  async deleteExpired(cutoffs: RetentionCutoffs): Promise<RetentionCounts> {
    return this.prisma.$transaction(async (tx) => {
      const triggers = await tx.trigger.deleteMany({
        where: {
          occurredAt: { lt: cutoffs.triggerBefore },
          disposition: { in: [...TRIGGER_DISPOSITIONS] },
        },
      });
      const outbound = await tx.outboundMessage.deleteMany({
        where: {
          OR: [
            { sentAt: { lt: cutoffs.outboundBefore } },
            {
              status: { in: [...OUTBOUND_STATUSES] },
              createdAt: { lt: cutoffs.outboundBefore },
            },
          ],
        },
      });
      const reports = await tx.report.deleteMany({
        where: { createdAt: { lt: cutoffs.reportBefore } },
      });
      return {
        triggers: triggers.count,
        outbound: outbound.count,
        reports: reports.count,
      };
    });
  }
}
