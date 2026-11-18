import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  modelControllerGet,
  modelControllerQuery,
  modelControllerRemove,
  modelControllerSetEnabled,
  modelControllerUpdate,
  providerControllerCreateModel,
} from '@/lib/api-client';
import { ApiError } from '@/lib/api-error';
import { mpKeys } from './keys';

/** models 表格行：POST /ai/models/query 响应的展示形态（生成 SDK 推导）。 */
export type ModelRow = NonNullable<
  Awaited<ReturnType<typeof modelControllerQuery>>['data']
>['items'][number];

/**
 * TableView query 适配：providerId 作为资源 scope 显式进入请求体、
 * 缓存键（TableView 内聚 identityKey/scope 键）与 session 存储隔离键。
 */
export { modelControllerQuery as queryModels };

/**
 * 模型列表（非表格消费者保留：报表模型映射、导入目录等）。
 * providerId 经服务端 scope 强制过滤；`all` 为 true 时翻页拉全量。
 */
export function useModelsList(
  providerId?: string,
  options?: { enabled?: boolean; all?: boolean },
) {
  const pageSize = 100;
  return useQuery({
    queryKey: mpKeys.modelsList(providerId ?? '', options?.all ?? false),
    enabled: options?.enabled,
    queryFn: async ({ signal }) => {
      const body = (page: number) => ({
        page,
        pageSize,
        filters: [],
        sort: [],
        ...(providerId ? { scope: { providerId } } : {}),
      });
      const first = await modelControllerQuery({
        signal,
        body: body(1),
      });
      if (first.error) throw new ApiError(first.error, '模型列表获取失败');
      const items = [...(first.data?.items ?? [])];
      const total = first.data?.total ?? 0;
      if (!options?.all) return items;
      let page = 2;
      while (items.length < total) {
        const next = await modelControllerQuery({
          signal,
          body: body(page),
        });
        if (next.error) throw new ApiError(next.error, '模型列表获取失败');
        const batch = next.data?.items ?? [];
        if (batch.length === 0) break;
        items.push(...batch);
        page += 1;
      }
      return items;
    },
  });
}

/**
 * 按 id 查询单个模型详情。
 * @returns 模型详情与请求状态。
 */
export function useModelDetail(id: string) {
  return useQuery({
    queryKey: mpKeys.model(id),
    queryFn: async ({ signal }) => {
      const { data, error } = await modelControllerGet({
        signal,
        path: { id },
      });
      if (error) throw new ApiError(error, '模型详情获取失败');
      return data;
    },
  });
}

/**
 * 在指定服务商下注册模型，成功后作废模型表格与详情缓存。
 * @throws 接口返回错误时 mutation 以 Error 拒绝，消息取自接口 detail。
 */
export function useCreateModel(providerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Parameters<typeof providerControllerCreateModel>[0]['body'],
    ) => {
      const { error } = await providerControllerCreateModel({
        path: { id: providerId },
        body: input,
      });
      if (error) throw new ApiError(error, '模型注册失败');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mpKeys.modelsListRoot });
      void queryClient.invalidateQueries({ queryKey: mpKeys.modelRoot });
      void queryClient.invalidateQueries({
        queryKey: ['table-view', 'mp-models'],
      });
    },
  });
}

/**
 * 更新模型配置，成功后作废模型表格、对应详情与列表缓存。
 * @throws 接口返回错误时 mutation 以 Error 拒绝，消息取自接口 detail。
 */
export function useUpdateModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      body: Parameters<typeof modelControllerUpdate>[0]['body'];
    }) => {
      const { data, error } = await modelControllerUpdate({
        path: { id: input.id },
        body: input.body,
      });
      if (error) throw new ApiError(error, '模型更新失败');
      return data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: mpKeys.model(variables.id),
      });
      void queryClient.invalidateQueries({ queryKey: mpKeys.modelsListRoot });
      void queryClient.invalidateQueries({
        queryKey: ['table-view', 'mp-models'],
      });
    },
  });
}

/**
 * 启停模型，成功后作废模型表格、对应详情与列表缓存。
 * @throws 接口返回错误时 mutation 以 Error 拒绝，消息取自接口 detail。
 */
export function useSetModelEnabled() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; enabled: boolean }) => {
      const { error } = await modelControllerSetEnabled({
        path: { id: input.id },
        body: { enabled: input.enabled },
      });
      if (error) throw new ApiError(error, '模型状态更新失败');
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: mpKeys.model(variables.id),
      });
      void queryClient.invalidateQueries({ queryKey: mpKeys.modelsListRoot });
      void queryClient.invalidateQueries({
        queryKey: ['table-view', 'mp-models'],
      });
    },
  });
}

/**
 * 删除模型，成功后作废模型表格缓存。
 * @throws 接口返回错误时 mutation 以 Error 拒绝，消息取自接口 detail。
 */
export function useRemoveModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await modelControllerRemove({ path: { id } });
      if (error) throw new ApiError(error, '模型删除失败');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mpKeys.modelsListRoot });
      void queryClient.invalidateQueries({ queryKey: mpKeys.modelRoot });
      void queryClient.invalidateQueries({
        queryKey: ['table-view', 'mp-models'],
      });
    },
  });
}
