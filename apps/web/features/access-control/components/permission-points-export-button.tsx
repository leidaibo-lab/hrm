'use client';

import { DownloadIcon } from 'lucide-react';

import { downloadCsv } from '@/components/table-view';
import { Button } from '@/components/ui/button';
import { usePermissionPoints } from '../api/permission-points';

const RESOURCE_LABELS: Record<string, string> = {
  user: '用户管理',
  role: '角色管理',
  navigation: '菜单管理',
  'permission-point': '权限点',
  'model-provider': '模型服务',
};

/** 页头「导出目录」：把权限点目录（含摘要覆盖）导出为 CSV。 */
export function PermissionPointsExportButton() {
  const points = usePermissionPoints();
  const rows = points.data ?? [];
  return (
    <Button
      type="button"
      variant="outline"
      disabled={points.isPending || rows.length === 0}
      onClick={() => {
        downloadCsv('permission-points.csv', [
          ['分组', '权限点', '摘要', '默认摘要', '状态'],
          ...rows.map((point) => [
            RESOURCE_LABELS[point.resource] ?? point.resource,
            point.code,
            point.summary,
            point.defaultSummary,
            point.state === 'active' ? '生效' : '已废弃',
          ]),
        ]);
      }}
    >
      <DownloadIcon />
      导出目录
    </Button>
  );
}
