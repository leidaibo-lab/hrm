import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  userControllerQuery,
  userControllerSetRoles,
  userControllerSetStatus,
} from '@/lib/api-client';
import { ApiError } from '@/lib/api-error';
import { iamKeys } from './keys';

/** users 表格行：POST /users/query 响应的展示形态（生成 SDK 推导，不手写 DTO）。 */
export type UserRow = NonNullable<
  Awaited<ReturnType<typeof userControllerQuery>>['data']
>['items'][number];

/**
 * TableView query 适配（唯一表格数据源）：通用协议序列化/日期/错误处理在
 * createTableQuery 内统一完成，feature 不重复编写筛选、排序与分页转换。
 */
export { userControllerQuery as queryUsers };

/** 命令面板等非表格场景的用户查询（只读 POST /query，非表格消费者保留）。 */
export function useUsersList(
  page: number,
  pageSize: number,
  options?: { enabled?: boolean; q?: string },
) {
  return useQuery({
    queryKey: iamKeys.usersList(page, pageSize, options?.q ?? ''),
    enabled: options?.enabled,
    queryFn: async ({ signal }) => {
      const body: NonNullable<
        Parameters<typeof userControllerQuery>[0]
      >['body'] = {
        page,
        pageSize,
        filters: [],
        sort: [],
      };
      if (options?.q) body.q = options.q;
      const { data, error } = await userControllerQuery({
        signal,
        body: body,
      });
      if (error) throw new ApiError(error, '用户列表获取失败');
      return data;
    },
  });
}

/**
 * 启停用户账号，成功后作废托管表格缓存（TableView 键前缀 = table-view + 表格 id）。
 * @throws 接口返回错误时 mutation 以 Error 拒绝，消息取自接口 detail。
 */
export function useSetUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      status: 'active' | 'suspended';
    }) => {
      const { error } = await userControllerSetStatus({
        path: { id: input.id },
        body: { status: input.status },
      });
      if (error) throw new ApiError(error, '状态更新失败');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['table-view', 'iam-users'],
      });
    },
  });
}

/**
 * 全量替换用户的角色绑定，成功后作废托管表格缓存。
 * @throws 接口返回错误时 mutation 以 Error 拒绝，消息取自接口 detail。
 */
export function useSetUserRoles() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; roleIds: string[] }) => {
      const { error } = await userControllerSetRoles({
        path: { id: input.id },
        body: { roleIds: input.roleIds },
      });
      if (error) throw new ApiError(error, '角色分配失败');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['table-view', 'iam-users'],
      });
    },
  });
}
