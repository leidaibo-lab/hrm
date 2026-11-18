import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  navigationControllerList,
  navigationControllerUpdate,
} from '@/lib/api-client';
import { ApiError } from '@/lib/api-error';
import { iamKeys } from './keys';
/**
 * 查询导航节点目录（含目录默认值与覆盖值）。
 * @returns 导航节点数组与请求状态。
 */
export function useNavigationNodes() {
  return useQuery({
    queryKey: iamKeys.navigationNodes,
    queryFn: async ({ signal }) => {
      const { data, error } = await navigationControllerList({ signal });
      if (error) throw new ApiError(error, '导航节点获取失败');
      return data;
    },
  });
}

/**
 * 更新导航节点的展示覆盖，成功后作废导航缓存。
 * @throws 接口返回错误时 mutation 以 Error 拒绝，消息取自接口 detail。
 */
export function useUpdateNavigationNode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      code: string;
      title: string | null;
      icon: string | null;
      sort: number | null;
      visible: boolean;
    }) => {
      const { error } = await navigationControllerUpdate({
        path: { code: input.code },
        body: {
          title: input.title,
          icon: input.icon,
          sort: input.sort,
          visible: input.visible,
        },
      });
      if (error) throw new ApiError(error, '导航更新失败');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: iamKeys.navigationNodes });
    },
  });
}
