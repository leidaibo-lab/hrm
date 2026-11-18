import type { TableQueryRequest } from '@cip/shared';
import { describe, expect, it } from 'vitest';
import type {
  UsageRepository,
  UsageSummaryView,
} from '../../domain/usage.repository';
import { UsageService } from '../usage.service';

const summary: UsageSummaryView = {
  totalCalls: 3,
  successCount: 1,
  failedCount: 1,
  rateLimitedCount: 1,
  cancelledCount: 0,
  totalInputTokens: 120,
  totalOutputTokens: 40,
  totalCost: '0.00042000',
  missingPriceCount: 1,
  missingFxCount: 0,
};

describe('UsageService', () => {
  it('汇总按筛选条件透传并返回成本与缺失计数', async () => {
    let received: unknown;
    const service = new UsageService({
      create: async () => undefined,
      summarize: async (filter) => {
        received = filter;
        return summary;
      },
      queryTable: async () => ({ items: [], total: 0, meta: summary }),
    } as UsageRepository);

    await expect(
      service.summary({ spaceId: 'space-1', logicalKey: 'chat-main' }),
    ).resolves.toEqual(summary);
    expect(received).toEqual({
      spaceId: 'space-1',
      logicalKey: 'chat-main',
    });
  });

  it('表格查询返回 items/total/meta 同条件结果', async () => {
    const service = new UsageService({
      create: async () => undefined,
      summarize: async () => summary,
      queryTable: async () => ({ items: [], total: 7, meta: summary }),
    } as UsageRepository);

    await expect(
      service.queryTable({} as TableQueryRequest),
    ).resolves.toMatchObject({ total: 7, meta: summary });
  });
});
