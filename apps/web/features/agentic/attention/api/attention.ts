import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  attentionControllerAnswer,
  attentionControllerList,
} from '@/lib/api-client';
import { ApiError } from '@/lib/api-error';
import { agenticKeys } from '../../shared/keys';

/** 待答关注列表。 */
export function useAttentionList(kind?: string) {
  return useQuery({
    queryKey: [...agenticKeys.attentions(), kind ?? 'all'] as const,
    queryFn: async ({ signal }) => {
      const result = await attentionControllerList({
        signal,
        ...(kind ? { query: { kind } } : {}),
      });
      if (result.error) throw new ApiError(result.error, '待办关注获取失败');
      return result.data.items;
    },
  });
}

/** 回答关注。 */
export function useAnswerAttention() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      answer: unknown;
      decision?: 'confirm' | 'modify' | 'reject';
      reason?: string;
    }) => {
      const result = await attentionControllerAnswer({
        path: { id: input.id },
        body: {
          answer: input.answer,
          decision: input.decision ?? 'confirm',
          ...(input.reason ? { reason: input.reason } : {}),
        },
      });
      if (result.error) throw new ApiError(result.error, '回答关注失败');
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: agenticKeys.all });
    },
  });
}
