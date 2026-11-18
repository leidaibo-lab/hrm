import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  modelControllerCreatePricing,
  modelControllerListPricings,
} from '@/lib/api-client';
import { ApiError } from '@/lib/api-error';
import { mpKeys } from './keys';
/**
 * 查询指定模型的价格版本列表。
 * @returns 价格版本数组与请求状态。
 */
export function usePricings(modelId: string) {
  return useQuery({
    queryKey: mpKeys.pricings(modelId),
    queryFn: async ({ signal }) => {
      const { data, error } = await modelControllerListPricings({
        signal,
        path: { id: modelId },
      });
      if (error) throw new ApiError(error, '价格版本获取失败');
      return data;
    },
  });
}

/**
 * 为指定模型追加价格版本，成功后作废价格与模型缓存。
 * @throws 接口返回错误时 mutation 以 Error 拒绝，消息取自接口 detail。
 */
export function useCreatePricing(modelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      body: Parameters<typeof modelControllerCreatePricing>[0]['body'],
    ) => {
      const { error } = await modelControllerCreatePricing({
        path: { id: modelId },
        body,
      });
      if (error) throw new ApiError(error, '价格版本创建失败');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mpKeys.modelRoot });
      void queryClient.invalidateQueries({
        queryKey: mpKeys.pricings(modelId),
      });
      void queryClient.invalidateQueries({ queryKey: mpKeys.modelsListRoot });
    },
  });
}
