'use client';

import type { TableQuery, TableViewProps } from '../types';
import type { TableViewStatus } from './data-table';
import { EmptyState } from './empty-state';

/** 空态/无结果/错误/加载/就绪的推导。 */
export function deriveTableViewStatus<T>(config: {
  isPending: boolean;
  error: import('../types').TableError | null;
  refetch: () => Promise<void>;
  rows: T[];
  tableQuery: TableQuery;
  isTransition: boolean;
  empty: TableViewProps<T>['empty'];
  queryControl: {
    query: TableQuery;
    refresh: () => Promise<void>;
    resetQuery: () => void;
  };
  clearSearchAndFilters: () => void;
  onEmptyAction?: () => void;
}): TableViewStatus {
  const {
    isPending,
    error,
    refetch,
    rows,
    tableQuery,
    isTransition,
    empty,
    clearSearchAndFilters,
  } = config;
  const filteredByView = tableQuery.q !== '' || tableQuery.filters.length > 0;
  const emptyContent = empty ? (
    <EmptyState
      icon={empty.icon}
      title={empty.title}
      description={empty.description}
      action={
        empty.action
          ? {
              label: empty.action.label,
              disabled: !(empty.action.enabled?.(config.queryControl) ?? true),
              onSelect: () => config.onEmptyAction?.(),
            }
          : undefined
      }
    />
  ) : null;
  if (rows.length > 0) return { kind: 'ready', transition: isTransition };
  if (isPending) return { kind: 'pending' };
  if (error) {
    return {
      kind: 'error',
      message: error.message,
      onRetry: () => void refetch(),
    };
  }
  if (filteredByView) {
    return {
      kind: 'no-result',
      content: (
        <EmptyState
          variant="no-result"
          title="没有匹配的结果"
          description="调整搜索词或清除筛选条件后重试。"
          action={{ label: '清除搜索与筛选', onSelect: clearSearchAndFilters }}
        />
      ),
    };
  }
  return { kind: 'empty', content: emptyContent };
}
