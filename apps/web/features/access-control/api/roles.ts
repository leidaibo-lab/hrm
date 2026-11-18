import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  roleControllerCreate,
  roleControllerGet,
  roleControllerQuery,
  roleControllerRemove,
  roleControllerSetPermissionPoints,
  roleControllerUpdate,
} from '@/lib/api-client';
import { ApiError } from '@/lib/api-error';
import { iamKeys } from './keys';

/** roles 表格行：POST /roles/query 响应的展示形态（生成 SDK 推导）。 */
export type RoleRow = NonNullable<
  Awaited<ReturnType<typeof roleControllerQuery>>['data']
>['items'][number];

/**
 * TableView query 适配：后端已实现真正分页/搜索/筛选与多列排序，
 * 不再做客户端假分页或本地排序。
 */
export { roleControllerQuery as queryRoles };

/**
 * 角色列表（非表格消费者保留：命令面板搜索、CSV 全量导出）。
 * `all` 为 true 时按 pageSize 上限翻页拉全量（导出场景）。
 */
export function useRolesList(options?: {
  enabled?: boolean;
  q?: string;
  all?: boolean;
}) {
  const pageSize = 100;
  return useQuery({
    queryKey: iamKeys.rolesList(options?.q ?? '', options?.all ?? false),
    enabled: options?.enabled,
    queryFn: async ({ signal }) => {
      const first = await roleControllerQuery({
        signal,
        body: {
          page: 1,
          pageSize,
          ...(options?.q ? { q: options.q } : {}),
          filters: [],
          sort: [],
        },
      });
      if (first.error) throw new ApiError(first.error, '角色列表获取失败');
      const items = [...(first.data?.items ?? [])];
      const total = first.data?.total ?? 0;
      if (!options?.all) return items;
      let page = 2;
      while (items.length < total) {
        const next = await roleControllerQuery({
          signal,
          body: {
            page,
            pageSize,
            ...(options?.q ? { q: options.q } : {}),
            filters: [],
            sort: [],
          },
        });
        if (next.error) throw new ApiError(next.error, '角色列表获取失败');
        const batch = next.data?.items ?? [];
        if (batch.length === 0) break;
        items.push(...batch);
        page += 1;
      }
      return items;
    },
  });
}

/**
 * 按 id 查询单个角色详情。
 * @returns 角色详情与请求状态。
 */
export function useRole(id: string) {
  return useQuery({
    queryKey: iamKeys.role(id),
    queryFn: async ({ signal }) => {
      const { data, error } = await roleControllerGet({ signal, path: { id } });
      if (error) throw new ApiError(error, '角色获取失败');
      return data;
    },
  });
}

/**
 * 创建角色，成功后作废托管表格缓存（TableView 键前缀 = table-view + 表格 id）。
 * @throws 接口返回错误时 mutation 以 Error 拒绝，消息取自接口 detail。
 */
export function useCreateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      code: string;
      name: string;
      description: string | null;
    }) => {
      const { error } = await roleControllerCreate({ body: input });
      if (error) throw new ApiError(error, '角色创建失败');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['table-view', 'iam-roles'],
      });
    },
  });
}

/**
 * 更新角色基本信息，成功后作废表格与对应详情缓存。
 * @throws 接口返回错误时 mutation 以 Error 拒绝，消息取自接口 detail。
 */
export function useUpdateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      name: string;
      description: string | null;
    }) => {
      const { data, error } = await roleControllerUpdate({
        path: { id: input.id },
        body: { name: input.name, description: input.description },
      });
      if (error) throw new ApiError(error, '角色更新失败');
      return data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ['table-view', 'iam-roles'],
      });
      void queryClient.invalidateQueries({
        queryKey: iamKeys.role(variables.id),
      });
    },
  });
}

/**
 * 全量替换角色的权限点授予，成功后作废表格与对应详情缓存。
 * @throws 接口返回错误时 mutation 以 Error 拒绝，消息取自接口 detail。
 */
export function useSetRolePermissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; permissionCodes: string[] }) => {
      const { data, error } = await roleControllerSetPermissionPoints({
        path: { id: input.id },
        body: { permissionCodes: input.permissionCodes },
      });
      if (error) throw new ApiError(error, '权限保存失败');
      return data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ['table-view', 'iam-roles'],
      });
      void queryClient.invalidateQueries({
        queryKey: iamKeys.role(variables.id),
      });
    },
  });
}

/**
 * 删除角色，成功后作废托管表格缓存。
 * @throws 接口返回错误时 mutation 以 Error 拒绝，消息取自接口 detail。
 */
export function useDeleteRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await roleControllerRemove({ path: { id } });
      if (error) throw new ApiError(error, '角色删除失败');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['table-view', 'iam-roles'],
      });
    },
  });
}
