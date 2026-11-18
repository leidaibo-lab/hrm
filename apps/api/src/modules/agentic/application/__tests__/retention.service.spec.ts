import { describe, expect, it } from 'vitest';
import { env } from '../../../../config/env';
import type {
  RetentionCounts,
  RetentionCutoffs,
} from '../../domain/retention.repository';
import { RetentionService } from '../retention.service';

const AT = new Date('2026-11-16T00:00:00.000Z');

class FakeRetention {
  counts: RetentionCounts = { triggers: 2, outbound: 3, reports: 4 };
  deleted: RetentionCutoffs | null = null;
  async countExpired(): Promise<RetentionCounts> {
    return this.counts;
  }
  async deleteExpired(cutoffs: RetentionCutoffs): Promise<RetentionCounts> {
    this.deleted = cutoffs;
    return this.counts;
  }
}

describe('RetentionService', () => {
  it('预检按 90/30/180 天计算阈值且不删除', async () => {
    const repository = new FakeRetention();
    const service = new RetentionService(repository);
    const result = await service.preview(AT);

    expect(result.counts).toEqual({ triggers: 2, outbound: 3, reports: 4 });
    expect(result.cutoffs.triggerBefore).toBe(
      new Date(AT.getTime() - 90 * 86_400_000).toISOString(),
    );
    expect(result.cutoffs.outboundBefore).toBe(
      new Date(AT.getTime() - 30 * 86_400_000).toISOString(),
    );
    expect(result.cutoffs.reportBefore).toBe(
      new Date(AT.getTime() - 180 * 86_400_000).toISOString(),
    );
    expect(repository.deleted).toBeNull();
  });

  it('开关关闭或确认串错误时拒绝删除', async () => {
    const repository = new FakeRetention();
    const service = new RetentionService(repository);
    const previous = env.AGENTIC_RETENTION_APPLY;
    env.AGENTIC_RETENTION_APPLY = 'false';

    await expect(service.apply('DELETE_EXPIRED', AT)).rejects.toThrow('未开启');
    env.AGENTIC_RETENTION_APPLY = 'true';
    await expect(service.apply('WRONG', AT)).rejects.toThrow('确认串');
    env.AGENTIC_RETENTION_APPLY = previous;
    expect(repository.deleted).toBeNull();
  });

  it('开关开启且确认串正确时执行删除', async () => {
    const repository = new FakeRetention();
    const service = new RetentionService(repository);
    const previous = env.AGENTIC_RETENTION_APPLY;
    env.AGENTIC_RETENTION_APPLY = 'true';

    await expect(service.apply('DELETE_EXPIRED', AT)).resolves.toEqual({
      deleted: { triggers: 2, outbound: 3, reports: 4 },
    });
    env.AGENTIC_RETENTION_APPLY = previous;
    expect(repository.deleted).not.toBeNull();
  });
});
