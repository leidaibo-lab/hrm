'use client';
import { downloadCsv } from '@/components/table-view';
import { useRolesList } from '../api/roles';

/** 按需获取权限范围内的完整角色列表，复用现有 CSV 格式。 */
export function useRolesExport() {
  const result = useRolesList({ enabled: false, all: true });
  return {
    pending: result.isFetching,
    run: async () => {
      const { data = [] } = await result.refetch({ throwOnError: true });
      downloadCsv('roles.csv', [
        ['角色名称', '标识', '类型', '权限点数', '描述', '创建时间'],
        ...data.map((role) => [
          role.name,
          role.code,
          role.isBuiltin ? '内置' : '自定义',
          role.isBuiltin ? '全部' : role.permissionCodes.length,
          role.isBuiltin ? '内置角色 · 全量权限' : role.description,
          role.createdAt,
        ]),
      ]);
    },
  };
}
