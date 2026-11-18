'use client';

import { DownloadIcon } from 'lucide-react';

import { downloadCsv } from '@/components/table-view';
import { Button } from '@/components/ui/button';
import { useProvidersList } from '../api/providers';

type ProviderRow = {
  slug: string;
  name: string;
  baseUrl: string;
  rateLimitPerMinute: number | null;
  maxConcurrent: number | null;
  enabled: boolean;
  modelCount: number;
  createdAt: string;
};

/** 页头「导出」：按当前权限可见的全量服务商导出 CSV（无分页，数据完整）。 */
export function ProvidersExportButton() {
  const providers = useProvidersList({ enabled: true, all: true });
  const rows = (providers.data ?? []) as ProviderRow[];
  return (
    <Button
      type="button"
      variant="outline"
      disabled={providers.isPending || rows.length === 0}
      onClick={() => {
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
          ...rows.map((row) => [
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
      }}
    >
      <DownloadIcon />
      导出
    </Button>
  );
}
