'use client';

import { useCallback, useMemo, useRef } from 'react';
import { useSessionStorage } from '@/hooks/use-session-storage';
import {
  defaultTableQuery,
  normalizeQuery,
  tableQuerySchema,
} from '../model/normalize-query';
import { tableScopeKey } from '../model/scope-key';
import type { QueryChangeReason, TableQuery, TableScope } from '../types';

/**
 * 表格查询状态：有效状态存 sessionStorage，键隔离版本、identityKey、
 * 表格 id 与稳定序列化的 scope；损坏/过期数据清理后退回默认值；存储不可用回退内存。
 */
export function useTableViewState(config: {
  id: string;
  identityKey: string;
  scope: TableScope;
  columns?: import('../types').TableViewColumn<never>[];
  maxSortRules?: number;
  defaultQuery?: Partial<TableQuery>;
  onQueryChange?: (event: {
    previous: TableQuery;
    next: TableQuery;
    reason: QueryChangeReason;
  }) => void;
}): {
  query: TableQuery;
  ready: boolean;
  update: (patch: Partial<TableQuery>, reason: QueryChangeReason) => void;
  replace: (query: TableQuery, reason: QueryChangeReason) => void;
} {
  const { id, identityKey, scope, onQueryChange } = config;
  const defaultQuery = useMemo(
    () => defaultTableQuery(config.defaultQuery),
    [config.defaultQuery],
  );

  // scope 稳定序列化（键序无关）：进入存储隔离键。
  const scopeKey = tableScopeKey(scope);

  const storageKey = `tv:q:v1:${identityKey}:${id}:${scopeKey}`;

  const storage = useSessionStorage<TableQuery>({
    key: storageKey,
    schema: tableQuerySchema,
    defaultValue: defaultQuery,
  });

  // schema 语义校验：tableQuerySchema 修复可修复项，不可修复项交回默认值。
  const query = useMemo(() => {
    if (!storage.ready) return defaultQuery;
    const parsed = tableQuerySchema.safeParse(storage.value);
    const candidate = parsed.success
      ? (parsed.data as TableQuery)
      : defaultQuery;
    const normalized = normalizeQuery(candidate, defaultQuery);
    if (config.columns) {
      normalized.filters = normalized.filters.filter((filter) => {
        const definition = config.columns?.find(
          (column) => column.id === filter.field,
        )?.filter;
        return (
          definition?.kind === filter.kind &&
          definition.operators.includes(filter.operator)
        );
      });
      normalized.sort = normalized.sort.filter((rule) =>
        config.columns?.some(
          (column) => column.id === rule.field && column.sortable,
        ),
      );
    }
    normalized.sort = normalized.sort.slice(0, config.maxSortRules ?? 5);
    return normalized;
  }, [
    storage.ready,
    storage.value,
    defaultQuery,
    config.columns,
    config.maxSortRules,
  ]);

  const lastQueryRef = useRef<TableQuery>(query);
  lastQueryRef.current = query;

  const emit = useCallback(
    (previous: TableQuery, next: TableQuery, reason: QueryChangeReason) => {
      try {
        onQueryChange?.({ previous, next, reason });
      } catch (cause) {
        // 回调自身抛错不得污染取数状态。
        console.error('onQueryChange 回调异常', cause);
      }
    },
    [onQueryChange],
  );

  const update = useCallback(
    (patch: Partial<TableQuery>, reason: QueryChangeReason) => {
      const previous = lastQueryRef.current;
      // 除翻页/页码修正/scope 恢复外，查询条件变化回到第一页。
      const withPageReset =
        reason === 'page' || reason === 'pageCorrection' || reason === 'scope'
          ? patch
          : { page: 1, ...patch };
      const next = normalizeQuery(
        { ...previous, ...withPageReset },
        defaultQuery,
      );
      if (JSON.stringify(previous) === JSON.stringify(next)) return;
      lastQueryRef.current = next;
      storage.setValue(next);
      emit(previous, next, reason);
    },
    [defaultQuery, emit, storage],
  );

  const replace = useCallback(
    (next: TableQuery, reason: QueryChangeReason) => {
      const previous = lastQueryRef.current;
      const normalized = normalizeQuery(next, defaultQuery);
      lastQueryRef.current = normalized;
      storage.setValue(normalized);
      if (reason !== 'scope') {
        // scope 恢复是状态装载不是用户变化，不触发 onQueryChange。
        emit(previous, normalized, reason);
      }
    },
    [defaultQuery, emit, storage],
  );

  return { query, ready: storage.ready, update, replace };
}
