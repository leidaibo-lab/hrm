import { ERROR_CODE } from '@cip/shared';
import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { env } from '../../../config/env';
import {
  RETENTION_REPOSITORY,
  type RetentionCounts,
  type RetentionCutoffs,
  type RetentionRepository,
} from '../domain/retention.repository';

/** 保留天数：事件 90、出站 30、回报 180（operations.md §五）。 */
export const RETENTION_DAYS = {
  trigger: 90,
  outbound: 30,
  report: 180,
} as const;

/** 物理删除所需确认串。 */
export const RETENTION_CONFIRM = 'DELETE_EXPIRED';

/** 保留归档：预检与显式开启的物理删除。 */
@Injectable()
export class RetentionService {
  constructor(
    @Inject(RETENTION_REPOSITORY)
    private readonly retention: RetentionRepository,
  ) {}

  /** 预检过期记录数，不删除。 */
  async preview(now: Date = new Date()): Promise<{
    cutoffs: Record<keyof RetentionCutoffs, string>;
    counts: RetentionCounts;
    applyEnabled: boolean;
  }> {
    const cutoffs = cutoffOf(now);
    return {
      cutoffs: {
        triggerBefore: cutoffs.triggerBefore.toISOString(),
        outboundBefore: cutoffs.outboundBefore.toISOString(),
        reportBefore: cutoffs.reportBefore.toISOString(),
      },
      counts: await this.retention.countExpired(cutoffs),
      applyEnabled: env.AGENTIC_RETENTION_APPLY === 'true',
    };
  }

  /** 物理删除：需环境开关 + 确认串，防误操作。 */
  async apply(
    confirm: string,
    now: Date = new Date(),
  ): Promise<{ deleted: RetentionCounts }> {
    if (env.AGENTIC_RETENTION_APPLY !== 'true')
      throw new ForbiddenException({
        code: ERROR_CODE.auth.forbidden,
        message: '保留归档删除未开启（AGENTIC_RETENTION_APPLY=false）',
      });
    if (confirm !== RETENTION_CONFIRM)
      throw new ForbiddenException({
        code: ERROR_CODE.auth.forbidden,
        message: `确认串不正确，需为 ${RETENTION_CONFIRM}`,
      });
    const cutoffs = cutoffOf(now);
    return { deleted: await this.retention.deleteExpired(cutoffs) };
  }
}

/** 按保留天数计算阈值。 */
function cutoffOf(now: Date): RetentionCutoffs {
  const days = 24 * 60 * 60 * 1000;
  return {
    triggerBefore: new Date(now.getTime() - RETENTION_DAYS.trigger * days),
    outboundBefore: new Date(now.getTime() - RETENTION_DAYS.outbound * days),
    reportBefore: new Date(now.getTime() - RETENTION_DAYS.report * days),
  };
}
