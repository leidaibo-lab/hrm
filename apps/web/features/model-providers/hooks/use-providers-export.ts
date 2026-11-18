'use client';
import { downloadCsv } from '@/components/table-view';
import { useProvidersList } from '../api/providers';

/** 按需获取权限范围内的完整供应商列表，复用现有 CSV 格式。 */
export function useProvidersExport() {
  const result = useProvidersList({ enabled: false, all: true });
  return {
    pending: result.isFetching,
    run: async () => {
      const { data = [] } = await result.refetch({ throwOnError: true });
      downloadCsv('providers.csv', [
        [
          '名称',
          '标识',
          'Base URL',
          '模型数',
          '限流 RPM',
          '并发',
          '状态',
          '创建时间',
        ],
        ...data.map((row) => [
          row.name,
          row.slug,
          row.baseUrl,
          row.modelCount,
          row.rateLimitPerMinute ?? '',
          row.maxConcurrent ?? '',
          row.enabled ? '启用' : '停用',
          row.createdAt,
        ]),
      ]);
    },
  };
}
