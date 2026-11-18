'use client';

import { hashKey, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { canonicalQueryKey } from '../model/normalize-query';
import type {
  LoadErrorEvent,
  LoadSuccessEvent,
  TableError,
  TableQuery,
  TableQueryFn,
  TableScope,
} from '../types';

/** 任意错误 → TableError（保留 code/status/traceId/errors，不退化为纯文案）。 */
function toTableError(error: unknown): TableError {
  if (error instanceof Error) {
    const source = error as Error & {
      code?: string;
      status?: number;
      traceId?: string;
      errors?: unknown[];
    };
    return {
      message: source.message || '数据加载失败',
      code: source.code,
      status: source.status,
      traceId: source.traceId,
      errors: source.errors,
    };
  }
  return { message: String(error) };
}

/**
 * 表格取数：queryKey = 表格 id + 身份 + scope + 规范化查询；
 * queryFn 透传 AbortSignal；参数/权限类 4xx 不重试，其余最多自动重试一次；
 * 过期响应不触发回调（TanStack 结构化并发保证）。
 */
export function useTableQuery<T, TMeta>(config: {
  id: string;
  identityKey: string;
  scope: TableScope;
  scopeKey: string;
  query: TableQueryFn<T, TMeta>;
  tableQuery: TableQuery;
  enabled: boolean;
  onLoadSuccess?: (event: LoadSuccessEvent<T, TMeta>) => void;
  onLoadError?: (event: LoadErrorEvent) => void;
}) {
  const { id, identityKey, scope, scopeKey, query, tableQuery, enabled } =
    config;

  const queryKey = useMemo(
    () => [
      'table-view',
      id,
      identityKey,
      scopeKey,
      canonicalQueryKey(tableQuery),
    ],
    [id, identityKey, scopeKey, tableQuery],
  );

  const client = useQueryClient();
  const callbacks = useRef(config);
  callbacks.current = config;
  const activeHash = hashKey(queryKey);
  const hashRef = useRef(activeHash);
  hashRef.current = activeHash;

  const result = useQuery({
    queryKey,
    queryFn: ({ signal }) => query(tableQuery, { signal, scope }),
    enabled,
    retry: (failureCount, error) => {
      const status = toTableError(error).status;
      if (status !== undefined && status >= 400 && status < 500) return false;
      return failureCount < 1;
    },
  });

  useEffect(
    () =>
      client.getQueryCache().subscribe((event) => {
        if (
          event.type !== 'updated' ||
          event.query.queryHash !== hashRef.current
        )
          return;
        const current = callbacks.current;
        try {
          if (event.action.type === 'success' && !event.action.manual) {
            current.onLoadSuccess?.({
              data: event.query.state.data as import('../types').TableData<
                T,
                TMeta
              >,
              query: current.tableQuery,
            });
          } else if (event.action.type === 'error') {
            const error = event.action.error;
            if (error instanceof Error && error.name === 'CancelledError')
              return;
            current.onLoadError?.({
              error: toTableError(error),
              query: current.tableQuery,
            });
          }
        } catch (cause) {
          console.error('TableView 加载回调异常', cause);
        }
      }),
    [client],
  );

  return {
    rows: result.data?.rows ?? [],
    total: result.data?.total ?? 0,
    meta: result.data?.meta,
    isPending: result.isPending || !enabled,
    isFetching: result.isFetching,
    /** 过渡态：查询条件变化期间保留的旧行（禁用选择与行操作）。 */
    isTransition: result.isPlaceholderData,
    error: result.error ? toTableError(result.error) : null,
    refetch: async () => {
      await result.refetch({ throwOnError: true });
    },
  };
}
