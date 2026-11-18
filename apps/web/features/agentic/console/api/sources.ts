import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  sourceAuthorizationControllerAuthorize,
  sourceAuthorizationControllerList,
  sourceAuthorizationControllerRevoke,
  sourceControllerCreate,
  sourceControllerDisable,
  sourceControllerEnable,
  sourceControllerHealthOf,
  sourceControllerList,
  sourceControllerUpdate,
} from '@/lib/api-client';
import { ApiError } from '@/lib/api-error';
import { agenticKeys } from '../../shared/keys';

/** 来源实例列表。 */
export function useSources() {
  return useQuery({
    queryKey: [...agenticKeys.all, 'sources'] as const,
    refetchInterval: 60_000,
    queryFn: async ({ signal }) => {
      const result = await sourceControllerList({ signal });
      if (result.error) throw new ApiError(result.error, '来源列表获取失败');
      return result.data.items;
    },
  });
}

/** 来源健康。 */
export function useSourceHealth(id: string) {
  return useQuery({
    queryKey: [...agenticKeys.all, 'source-health', id] as const,
    refetchInterval: 30_000,
    queryFn: async ({ signal }) => {
      const result = await sourceControllerHealthOf({
        signal,
        path: { id },
      });
      if (result.error) throw new ApiError(result.error, '来源健康获取失败');
      return result.data.items;
    },
  });
}

/** 创建来源。 */
export function useCreateSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      sourceType: 'lark' | 'zentao' | 'gitlab';
      name: string;
      config: Record<string, unknown>;
      botId?: string;
    }) => {
      const result = await sourceControllerCreate({ body: input });
      if (result.error) throw new ApiError(result.error, '创建来源失败');
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: agenticKeys.all });
    },
  });
}

/** 修改来源。 */
export function useUpdateSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      name?: string;
      config?: Record<string, unknown>;
      botId?: string | null;
    }) => {
      const { id, ...body } = input;
      const result = await sourceControllerUpdate({ path: { id }, body });
      if (result.error) throw new ApiError(result.error, '修改来源失败');
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: agenticKeys.all });
    },
  });
}

/** 启停来源。 */
export function useToggleSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; enabled: boolean }) => {
      const result = input.enabled
        ? await sourceControllerEnable({ path: { id: input.id } })
        : await sourceControllerDisable({ path: { id: input.id } });
      if (result.error) throw new ApiError(result.error, '启停来源失败');
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: agenticKeys.all });
    },
  });
}

/** 查询来源授权。 */
export function useSourceAuthorizations(sourceId: string) {
  return useQuery({
    queryKey: [...agenticKeys.all, 'source-auth', sourceId] as const,
    queryFn: async ({ signal }) => {
      const result = await sourceAuthorizationControllerList({
        signal,
        path: { id: sourceId },
      });
      if (result.error) throw new ApiError(result.error, '来源授权获取失败');
      return result.data.items;
    },
  });
}

/** 授权来源范围。 */
export function useAuthorizeSource(sourceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      scopeKey: string;
      expiresAt?: string | null;
    }) => {
      const result = await sourceAuthorizationControllerAuthorize({
        path: { id: sourceId },
        body,
      });
      if (result.error) throw new ApiError(result.error, '来源授权失败');
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [...agenticKeys.all, 'source-auth', sourceId],
      });
    },
  });
}

/** 撤销来源范围授权。 */
export function useRevokeSourceAuthorization(sourceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (scopeKey: string) => {
      const result = await sourceAuthorizationControllerRevoke({
        path: { id: sourceId, scopeKey },
      });
      if (result.error) throw new ApiError(result.error, '撤销来源授权失败');
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [...agenticKeys.all, 'source-auth', sourceId],
      });
    },
  });
}
