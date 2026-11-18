import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  policyControllerAdmissionRules,
  policyControllerCurrent,
  policyControllerPublish,
  policyControllerPublishAdmissionRules,
} from '@/lib/api-client';
import { ApiError } from '@/lib/api-error';
import { agenticKeys } from '../../shared/keys';

/** 当前策略。 */
export function useCurrentPolicy() {
  return useQuery({
    queryKey: [...agenticKeys.all, 'policy'] as const,
    queryFn: async ({ signal }) => {
      const result = await policyControllerCurrent({ signal });
      if (result.error) throw new ApiError(result.error, '策略获取失败');
      return result.data.policy;
    },
  });
}

/** 发布策略新版本。 */
export function usePublishPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      acceptMode: 'explicit' | 'inferred';
      rules: Record<string, unknown>;
    }) => {
      const result = await policyControllerPublish({ body: input });
      if (result.error) throw new ApiError(result.error, '策略发布失败');
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: agenticKeys.all });
    },
  });
}

/** 策略准入表。 */
export function useAdmissionRules(policyId: string | undefined) {
  return useQuery({
    queryKey: [...agenticKeys.all, 'admission-rules', policyId] as const,
    enabled: Boolean(policyId),
    queryFn: async ({ signal }) => {
      const result = await policyControllerAdmissionRules({
        signal,
        path: { id: policyId ?? '' },
      });
      if (result.error) throw new ApiError(result.error, '准入表获取失败');
      return result.data.items;
    },
  });
}

/** 发布准入规则。 */
export function usePublishAdmissionRules(policyId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      sourceInstanceId: string;
      scopeRow: string;
      cell:
        | 'listed_unaddressed'
        | 'unlisted_addressed'
        | 'unlisted_unaddressed';
      allowed: boolean;
    }) => {
      const result = await policyControllerPublishAdmissionRules({
        path: { id: policyId ?? '' },
        body: { rules: [input] },
      });
      if (result.error) throw new ApiError(result.error, '准入规则发布失败');
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: agenticKeys.all });
    },
  });
}
