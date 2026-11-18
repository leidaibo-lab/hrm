'use client';

import { DownloadIcon } from 'lucide-react';
import { toast } from 'sonner';

import { downloadCsv } from '@/components/table-view';
import { Button } from '@/components/ui/button';
import { useRolesList } from '../api/roles';

type RoleRow = {
  code: string;
  name: string;
  description: string | null;
  isBuiltin: boolean;
  permissionCodes: string[];
  createdAt: string;
};

/** 页头「导出」：按当前权限可见的全量角色导出 CSV（无分页，数据完整）。 */
export function RolesExportButton() {
  const roles = useRolesList({ enabled: true, all: true });
  const rows = (roles.data ?? []) as RoleRow[];
  return (
    <Button
      type="button"
      variant="outline"
      disabled={roles.isPending || rows.length === 0}
      onClick={() => {
        if (rows.length === 0) {
          toast.error('暂无可导出的角色');
          return;
        }
        downloadCsv('roles.csv', [
          ['角色名称', '标识', '类型', '权限点数', '描述', '创建时间'],
          ...rows.map((role) => [
            role.name,
            role.code,
            role.isBuiltin ? '内置' : '自定义',
            role.isBuiltin ? '全部' : role.permissionCodes.length,
            role.isBuiltin ? '内置角色 · 全量权限' : role.description,
            role.createdAt,
          ]),
        ]);
      }}
    >
      <DownloadIcon />
      导出
    </Button>
  );
}
