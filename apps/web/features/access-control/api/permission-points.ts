import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  permissionPointControllerList,
  permissionPointControllerUpdateSummary,
} from '@/lib/api-client';
import { ApiError } from '@/lib/api-error';
import { iamKeys } from './keys';
/**
 * 查询权限点目录及其展示摘要。
 * @returns 权限点数组与请求状态。
 */
export function usePermissionPoints() {
  return useQuery({
    queryKey: iamKeys.permissionPoints,
    queryFn: async ({ signal }) => {
      const { data, error } = await permissionPointControllerList({ signal });
      if (error) throw new ApiError(error, '权限点获取失败');
      return data;
    },
  });
}

/**
 * 更新单个权限点的展示摘要，成功后作废权限点缓存。
 * @throws 接口返回错误时 mutation 以 Error 拒绝，消息取自接口 detail。
 */
export function useUpdatePermissionSummary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { code: string; summary: string | null }) => {
      const { error } = await permissionPointControllerUpdateSummary({
        path: { code: input.code },
        body: { summary: input.summary },
      });
      if (error) throw new ApiError(error, '摘要更新失败');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: iamKeys.permissionPoints,
      });
    },
  });
}
