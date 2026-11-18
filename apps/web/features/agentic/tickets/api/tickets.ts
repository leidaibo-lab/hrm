import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ticketControllerDetail,
  ticketControllerEnd,
  ticketControllerList,
  ticketControllerReopen,
  ticketControllerRestoreArtifact,
  ticketControllerRevokeWriteback,
  ticketControllerTimelineForTicket,
} from '@/lib/api-client';
import { ApiError } from '@/lib/api-error';
import { agenticKeys } from '../../shared/keys';

/** 工单列表。 */
export function useTickets(filter: {
  status?: 'open' | 'ended';
  scopeKey?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: agenticKeys.tickets(filter),
    queryFn: async ({ signal }) => {
      const result = await ticketControllerList({
        signal,
        query: {
          limit: filter.limit ?? 50,
          ...(filter.status ? { status: filter.status } : {}),
          ...(filter.scopeKey ? { scopeKey: filter.scopeKey } : {}),
        },
      });
      if (result.error) throw new ApiError(result.error, '工单列表获取失败');
      return result.data.items;
    },
  });
}

/** 工单详情。 */
export function useTicket(id: string) {
  return useQuery({
    queryKey: agenticKeys.ticket(id),
    queryFn: async ({ signal }) => {
      const result = await ticketControllerDetail({
        signal,
        path: { id },
      });
      if (result.error) throw new ApiError(result.error, '工单详情获取失败');
      return result.data;
    },
  });
}

/** 工单轨迹。 */
export function useTicketTimeline(id: string, at?: string) {
  return useQuery({
    queryKey: [...agenticKeys.ticket(id), 'timeline', at ?? 'now'] as const,
    queryFn: async ({ signal }) => {
      const result = await ticketControllerTimelineForTicket({
        signal,
        path: { id },
        ...(at ? { query: { at } } : {}),
      });
      if (result.error) throw new ApiError(result.error, '工单轨迹获取失败');
      return result.data;
    },
  });
}

/** 回滚产物到上一版本。 */
export function useRestoreArtifact(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (kind: string) => {
      const result = await ticketControllerRestoreArtifact({
        path: { id },
        query: {
          kind: kind as 'clarify' | 'breakdown' | 'analysis' | 'report',
        },
      });
      if (result.error) throw new ApiError(result.error, '产物回滚失败');
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: agenticKeys.ticket(id) });
    },
  });
}

/** 撤销上一版本字段回填。 */
export function useRevokeWriteback(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (kind: string) => {
      const result = await ticketControllerRevokeWriteback({
        path: { id },
        query: {
          kind: kind as 'clarify' | 'breakdown' | 'analysis' | 'report',
        },
      });
      if (result.error) throw new ApiError(result.error, '撤销回填失败');
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: agenticKeys.ticket(id) });
    },
  });
}

/** 结束工单。 */
export function useEndTicket(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reason: string) => {
      const result = await ticketControllerEnd({
        path: { id },
        body: { reason },
      });
      if (result.error) throw new ApiError(result.error, '结束工单失败');
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: agenticKeys.ticket(id) });
      void queryClient.invalidateQueries({ queryKey: agenticKeys.all });
    },
  });
}

/** 重新打开工单。 */
export function useReopenTicket(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const result = await ticketControllerReopen({ path: { id } });
      if (result.error) throw new ApiError(result.error, '重新打开工单失败');
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: agenticKeys.ticket(id) });
      void queryClient.invalidateQueries({ queryKey: agenticKeys.all });
    },
  });
}
