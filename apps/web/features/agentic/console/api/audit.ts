import { useQuery } from '@tanstack/react-query';
import { auditControllerList } from '@/lib/api-client';
import { ApiError } from '@/lib/api-error';
import { agenticKeys } from '../../shared/keys';

/** 审计记录。 */
export function useAuditRecords(filter: {
  action?: string;
  traceId?: string;
  offset?: number;
}) {
  return useQuery({
    queryKey: [
      ...agenticKeys.all,
      'audit',
      filter.action ?? 'all',
      filter.traceId ?? 'all',
      filter.offset ?? 0,
    ] as const,
    queryFn: async ({ signal }) => {
      const result = await auditControllerList({
        signal,
        query: {
          limit: 100,
          ...(filter.offset ? { offset: filter.offset } : {}),
          ...(filter.action ? { action: filter.action } : {}),
          ...(filter.traceId ? { traceId: filter.traceId } : {}),
        },
      });
      if (result.error) throw new ApiError(result.error, '审计记录获取失败');
      return result.data.items;
    },
  });
}
