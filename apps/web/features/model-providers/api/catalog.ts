import { useQuery } from '@tanstack/react-query';

import { catalogControllerGet, catalogControllerList } from '@/lib/api-client';
import { ApiError } from '@/lib/api-error';
import { mpKeys } from './keys';
/**
 * 查询模型目录的聚合服务商清单。
 * @returns 目录服务商数组与请求状态。
 */
export function useCatalog() {
  return useQuery({
    queryKey: mpKeys.catalog,
    queryFn: async ({ signal }) => {
      const { data, error } = await catalogControllerList({ signal });
      if (error) throw new ApiError(error, '模型目录获取失败');
      return data;
    },
  });
}

/**
 * 查询模型目录中指定服务商的模型选择项。
 * @returns 目录服务商详情与请求状态。
 */
export function useCatalogDetail(providerId: string) {
  return useQuery({
    queryKey: [...mpKeys.catalog, providerId],
    enabled: providerId.length > 0,
    queryFn: async ({ signal }) => {
      const { data, error } = await catalogControllerGet({
        signal,
        path: { providerId },
      });
      if (error) throw new ApiError(error, '目录服务商获取失败');
      return data;
    },
  });
}
