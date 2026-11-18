import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  providerControllerCreate,
  providerControllerGet,
  providerControllerQuery,
  providerControllerRemove,
  providerControllerSetEnabled,
  providerControllerTestConnection,
  providerControllerUpdate,
} from '@/lib/api-client';
import { ApiError } from '@/lib/api-error';
import { mpKeys } from './keys';

/** providers 表格行：POST /ai/providers/query 响应的展示形态（生成 SDK 推导）。 */
export type ProviderRow = NonNullable<
  Awaited<ReturnType<typeof providerControllerQuery>>['data']
>['items'][number];

/**
 * TableView query 适配：后端已实现分页/搜索/status 投影筛选与多列排序，
 * 不再做全量拉取与本地排序。
 */
export { providerControllerQuery as queryProviders };

/**
 * 服务商列表（非表格消费者保留：命令面板、CSV 全量导出）。
 * `all` 为 true 时按 pageSize 上限翻页拉全量。
 */
export function useProvidersList(options?: {
  enabled?: boolean;
  q?: string;
  all?: boolean;
}) {
  const pageSize = 100;
  return useQuery({
    queryKey: mpKeys.providersList(options?.q ?? '', options?.all ?? false),
    enabled: options?.enabled,
    queryFn: async ({ signal }) => {
      const first = await providerControllerQuery({
        signal,
        body: {
          page: 1,
          pageSize,
          ...(options?.q ? { q: options.q } : {}),
          filters: [],
          sort: [],
        },
      });
      if (first.error) throw new ApiError(first.error, '供应商列表获取失败');
      const items = [...(first.data?.items ?? [])];
      const total = first.data?.total ?? 0;
      if (!options?.all) return items;
      let page = 2;
      while (items.length < total) {
        const next = await providerControllerQuery({
          signal,
          body: {
            page,
            pageSize,
            ...(options?.q ? { q: options.q } : {}),
            filters: [],
            sort: [],
          },
        });
        if (next.error) throw new ApiError(next.error, '供应商列表获取失败');
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
 * 按 id 查询服务商详情；与列表共用 providers 键前缀，便于整域失效。
 * @returns 服务商详情与请求状态。
 */
export function useProviderDetail(id: string) {
  return useQuery({
    queryKey: mpKeys.provider(id),
    queryFn: async ({ signal }) => {
      const { data, error } = await providerControllerGet({
        signal,
        path: { id },
      });
      if (error) throw new ApiError(error, '供应商详情获取失败');
      return data;
    },
  });
}

/** 服务商域的缓存失效：两个托管表格、非表格列表、服务商详情与外部目录。 */
function useInvalidateProviderTables() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({
      queryKey: ['table-view', 'mp-providers'],
    });
    void queryClient.invalidateQueries({
      queryKey: ['table-view', 'mp-models'],
    });
    void queryClient.invalidateQueries({ queryKey: mpKeys.providersListRoot });
    void queryClient.invalidateQueries({ queryKey: mpKeys.providerRoot });
    void queryClient.invalidateQueries({ queryKey: mpKeys.catalog });
  };
}

/**
 * 创建服务商，成功后作废服务商与模型表格缓存。
 * @throws 接口返回错误时 mutation 以 Error 拒绝，消息取自接口 detail。
 */
export function useCreateProvider() {
  const invalidate = useInvalidateProviderTables();
  return useMutation({
    mutationFn: async (
      input: Parameters<typeof providerControllerCreate>[0]['body'],
    ) => {
      const { error } = await providerControllerCreate({ body: input });
      if (error) throw new ApiError(error, '供应商创建失败');
    },
    onSuccess: () => invalidate(),
  });
}

/**
 * 更新服务商配置，成功后作废服务商与模型表格缓存。
 * @throws 接口返回错误时 mutation 以 Error 拒绝，消息取自接口 detail。
 */
export function useUpdateProvider() {
  const invalidate = useInvalidateProviderTables();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      body: Parameters<typeof providerControllerUpdate>[0]['body'];
    }) => {
      const { error } = await providerControllerUpdate({
        path: { id: input.id },
        body: input.body,
      });
      if (error) throw new ApiError(error, '供应商更新失败');
    },
    onSuccess: () => invalidate(),
  });
}

/**
 * 启停服务商，成功后作废服务商与模型表格缓存。
 * @throws 接口返回错误时 mutation 以 Error 拒绝，消息取自接口 detail。
 */
export function useSetProviderEnabled() {
  const invalidate = useInvalidateProviderTables();
  return useMutation({
    mutationFn: async (input: { id: string; enabled: boolean }) => {
      const { error } = await providerControllerSetEnabled({
        path: { id: input.id },
        body: { enabled: input.enabled },
      });
      if (error) throw new ApiError(error, '供应商状态更新失败');
    },
    onSuccess: () => invalidate(),
  });
}

/**
 * 删除服务商，成功后作废服务商与模型表格缓存。
 * @throws 接口返回错误时 mutation 以 Error 拒绝，消息取自接口 detail。
 */
export function useRemoveProvider() {
  const invalidate = useInvalidateProviderTables();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await providerControllerRemove({ path: { id } });
      if (error) throw new ApiError(error, '供应商删除失败');
    },
    onSuccess: () => invalidate(),
  });
}

/**
 * 对服务商发起一次连通性测试，不写任何缓存。
 * @returns 测试结果与请求状态。
 */
export function useTestProvider() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await providerControllerTestConnection({
        path: { id },
      });
      if (error) throw new ApiError(error, '连通性测试执行失败');
      return data;
    },
  });
}
