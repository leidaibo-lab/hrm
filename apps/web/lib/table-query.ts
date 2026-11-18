import type {
  TableData,
  TableQuery,
  TableQueryFn,
  TableScope,
} from '@/components/table-view/types';
import { ApiError } from '@/lib/api-error';

/**
 * TableView 通用 SDK 适配器：把 TableQuery + scope + signal 序列化到
 * 生成的 SDK request，并将 { items, total, meta } 映射为 { rows, total, meta }。
 * 只处理通用协议：日期毫秒转 ISO UTC、删除本地 kind（服务端 zod 剥离）、保留结构化错误；
 * 特殊字段类型/映射在后端字段 schema 中解决，feature 不重复编写通用转换。
 */

/** 生成 SDK request 的最小结构签名：任何单参 SDK 查询函数都可赋值（参数逆变）。 */
type TableQuerySdkRequest = (options: never) => Promise<unknown>;

/** SDK 响应载荷形态（契约管线：{ items, total, meta? } 裸载荷）。 */
type TableQueryHttpPayload = {
  items?: unknown[];
  total?: number;
  meta?: unknown;
};

/** RFC 9457 问题详情中 TableView 消费的字段。 */
type ProblemDetailFields = {
  detail?: string;
  code?: string;
  status?: number;
  traceId?: string;
  errors?: unknown[];
};

/** 提取 SDK 返回结构中的 data/error（hey-api RequestResult resolve 形态）。 */
function unwrapSdkResult(result: unknown): {
  data: TableQueryHttpPayload | undefined;
  error: ProblemDetailFields | undefined;
} {
  const payload = result as {
    data?: TableQueryHttpPayload;
    error?: ProblemDetailFields;
  };
  return { data: payload?.data, error: payload?.error };
}

/**
 * 创建 TableView 的 query 函数。同步工厂，不在创建时发请求；可直接内联于
 * `query` prop，无需 useMemo/useCallback——query cache key 不含本函数引用，
 * 渲染重建不会造成 cache miss 或重复请求。
 */
type SdkData<R extends TableQuerySdkRequest> = NonNullable<
  Awaited<ReturnType<R>> extends infer Result
    ? Result extends { data?: infer D }
      ? D
      : never
    : never
>;
type SdkRow<R extends TableQuerySdkRequest> =
  SdkData<R> extends { items: (infer Row)[] } ? Row : never;
type SdkMeta<R extends TableQuerySdkRequest> =
  SdkData<R> extends { meta?: infer Meta } ? Meta : unknown;

/** 从生成 SDK 自动推导行和汇总类型。 */
export function createTableQuery<R extends TableQuerySdkRequest>(config: {
  request: R;
}): TableQueryFn<SdkRow<R>, SdkMeta<R>>;
/** 创建无副作用适配器，仅在 Query 执行时发送请求。 */
export function createTableQuery<TRow, TMeta>(config: {
  request: TableQuerySdkRequest;
}): TableQueryFn<TRow, TMeta> {
  return async (
    query: TableQuery,
    context: { signal: AbortSignal; scope: TableScope },
  ): Promise<TableData<TRow, TMeta>> => {
    const body = {
      page: query.page,
      pageSize: query.pageSize,
      ...(query.q ? { q: query.q } : {}),
      scope: context.scope,
      filters: query.filters.map((filter) => {
        const common = { field: filter.field, operator: filter.operator };
        if (filter.kind === 'date') {
          return { ...common, value: new Date(filter.value).toISOString() };
        }
        if (filter.kind === 'enum') return { ...common, values: filter.values };
        return { ...common, value: filter.value };
      }),
      sort: query.sort,
    };
    const result = await (
      config.request as (options: {
        body: unknown;
        signal: AbortSignal;
      }) => Promise<unknown>
    )({ body, signal: context.signal });
    const { data, error } = unwrapSdkResult(result);
    if (error) {
      throw new ApiError(error, '数据加载失败');
    }
    if (
      !data ||
      !Array.isArray(data.items) ||
      !Number.isSafeInteger(data.total) ||
      (data.total ?? -1) < 0
    ) {
      throw new Error('查询响应不符合分页契约');
    }
    return {
      rows: (data?.items ?? []) as TRow[],
      total: data?.total ?? 0,
      meta: data?.meta as TMeta,
    };
  };
}
