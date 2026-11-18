'use client';

import { useQuery } from '@tanstack/react-query';
import { mgProvider0, mgUsage0, mgUsage1 } from '@/lib/api-client';

/** 供应商列表查询。 */
export function useProvidersQuery() {
  return useQuery({
    queryKey: ['model-gateway', 'providers'],
    queryFn: async () => {
      const result = await mgProvider0();
      if (result.error) throw new Error('供应商列表获取失败');
      return result.data ?? [];
    },
  });
}

/** 用量汇总查询。 */
export function useUsageSummaryQuery() {
  return useQuery({
    queryKey: ['model-gateway', 'usage-summary'],
    queryFn: async () => {
      const result = await mgUsage1();
      if (result.error) throw new Error('用量汇总获取失败');
      return result.data;
    },
  });
}

/** 最近用量查询。 */
export function useRecentUsageQuery() {
  return useQuery({
    queryKey: ['model-gateway', 'usage-recent'],
    queryFn: async () => {
      const result = await mgUsage0({
        body: { page: 1, pageSize: 20, filters: [], sort: [] },
      });
      if (result.error) throw new Error('用量明细获取失败');
      return result.data?.items ?? [];
    },
  });
}
