import { useQuery } from '@tanstack/react-query';
import { threadControllerDetail, threadControllerList } from '@/lib/api-client';
import { ApiError } from '@/lib/api-error';
import { agenticKeys } from '../../shared/keys';

/** 最近线程列表。 */
export function useThreads(limit = 50) {
  return useQuery({
    queryKey: [...agenticKeys.all, 'threads', limit] as const,
    queryFn: async ({ signal }) => {
      const result = await threadControllerList({
        signal,
        query: { limit },
      });
      if (result.error) throw new ApiError(result.error, '线程列表获取失败');
      return result.data.items;
    },
  });
}

/** 线程详情。 */
export function useThread(key: string) {
  return useQuery({
    queryKey: [...agenticKeys.all, 'thread', key] as const,
    queryFn: async ({ signal }) => {
      const result = await threadControllerDetail({
        signal,
        path: { key },
      });
      if (result.error) throw new ApiError(result.error, '线程详情获取失败');
      return result.data;
    },
  });
}
