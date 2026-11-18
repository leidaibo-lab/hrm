'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  deriveMaxSortRules,
  deriveRenderColumns,
  deriveSettableColumns,
} from '../model/column-capabilities';
import { effectiveColumnOrder } from '../model/normalize-columns';
import { defaultTableQuery } from '../model/normalize-query';
import { tableScopeKey } from '../model/scope-key';
import { filterableFields } from '../parts/filter-bar';
import type { SortableField } from '../parts/sort-popover';
import type { ColumnStateReason, TableViewProps } from '../types';
import { useColumnSettings } from './use-column-settings';
import { useMediaQuery } from './use-media-query';
import { useTableActionItems } from './use-table-action-items';
import { useTableActions } from './use-table-actions';
import { useColumnDrag } from './use-table-drag';
import { useTablePreferences } from './use-table-preferences';
import { useTableQuery } from './use-table-query';
import { useTableSelection } from './use-table-selection';
import { useTableViewState } from './use-table-view-state';

const DRAG_HEADER_HEIGHT = 36;

/** 编排 hook 入参：props 全量 + selection 预判（供组合层传递）。 */
export type TableViewStateConfig<T, TMeta> = TableViewProps<T, TMeta> & {
  /** 是否启用当前页行选择。 */
  selectionEnabled: boolean;
};

/**
 * TableView 状态编排：
 * 查询状态/偏好/取数/选择/动作/拖拽/列设置与动作闭包全部在此，
 * 搬走后组件 JSX 一行不改。返回值供渲染层直接消费。
 */
export function useTableViewController<T, TMeta>(
  props: TableViewStateConfig<T, TMeta>,
) {
  const {
    id,
    identityKey,
    scope = {},
    query,
    columns,
    rowKey,
    toolbar = {},
    actions = [],
    selection,
    defaultQuery,
    layout,
    onQueryChange,
    onSelectionChange,
    onColumnStateChange,
    onLoadSuccess,
    onLoadError,
    onActionStart,
    onActionSuccess,
    onActionError,
  } = props;
  const selectionEnabled = selection?.enabled ?? false;

  const queryClient = useQueryClient();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isRailBand = useMediaQuery(
    '(min-width: 1024px) and (max-width: 1279px)',
  );
  const initialQuery = useMemo(
    () => defaultTableQuery(defaultQuery),
    [defaultQuery],
  );

  // 查询变化先清空选择，再让新数据清理生效，避免事件原因被改成 data。
  const resetSelectionRef = useRef<(reason: 'query' | 'scope') => void>(
    () => undefined,
  );

  // ===== 查询状态（sessionStorage；scope 隔离键）=====
  const {
    query: tableQuery,
    ready,
    update,
    replace,
  } = useTableViewState({
    id,
    identityKey,
    scope,
    defaultQuery,
    onQueryChange: (event) => {
      resetSelectionRef.current(event.reason === 'scope' ? 'scope' : 'query');
      onQueryChange?.(event);
    },
    columns: columns as TableViewProps<never>['columns'],
    maxSortRules: deriveMaxSortRules(toolbar),
  });

  // ===== scope 变化：取消旧请求；状态由存储键切换自动恢复 =====
  const scopeKey = tableScopeKey(scope);
  const partition = JSON.stringify([id, identityKey, scopeKey]);
  const lastPartition = useRef({ id, identityKey, scopeKey, key: partition });
  const partitionRef = useRef(partition);
  partitionRef.current = partition;
  const [scopeEpoch, setScopeEpoch] = useState(0);
  useEffect(() => {
    const previous = lastPartition.current;
    if (previous.key === partition) return;
    lastPartition.current = { id, identityKey, scopeKey, key: partition };
    void queryClient.cancelQueries({
      queryKey: [
        'table-view',
        previous.id,
        previous.identityKey,
        previous.scopeKey,
      ],
    });
    setScopeEpoch((epoch) => epoch + 1);
  }, [scopeKey, identityKey, id, partition, queryClient]);

  // ===== 列偏好（localStorage）=====
  const {
    state: columnState,
    update: updateColumns,
    reset: resetColumns,
  } = useTablePreferences({
    id,
    identityKey,
    scope,
    columns: columns as TableViewProps<unknown>['columns'],
    onColumnStateChange,
  });

  // ===== 动作（pending 绑定固定目标）=====
  const selectionSettleRef = useRef<(succeededIds: string[]) => void>(
    () => undefined,
  );
  const actionsApi = useTableActions<T>({
    rowKey,
    onSettle: (succeededIds) => {
      if (partitionRef.current === partition)
        selectionSettleRef.current(succeededIds);
    },
    onActionStart,
    onActionSuccess,
    onActionError,
  });

  // ===== 取数 =====
  const {
    rows,
    total,
    meta,
    isPending,
    isFetching,
    isTransition,
    error,
    refetch,
  } = useTableQuery<T, TMeta>({
    id,
    identityKey,
    scope,
    scopeKey,
    query,
    tableQuery,
    enabled: ready,
    onLoadSuccess,
    onLoadError,
  });

  // ===== 选择（当前页；真实 rows 供 stale 清理）=====
  const selectionApi = useTableSelection<T>({
    partitionKey: partition,
    rows,
    rowKey,
    enabled: selectionEnabled,
    onSelectionChange,
  });
  resetSelectionRef.current = (reason) => selectionApi.clear(reason);
  selectionSettleRef.current = (succeededIds) =>
    selectionApi.settleAction(succeededIds);
  const selectionApiRef = useRef(selectionApi);
  selectionApiRef.current = selectionApi;

  useEffect(() => {
    if (scopeEpoch > 0) selectionApiRef.current.resetForScope();
  }, [scopeEpoch]);

  // ===== 查询条件变化清空选择=====
  const lastQueryKeyRef = useRef(JSON.stringify(tableQuery));
  useEffect(() => {
    const key = JSON.stringify(tableQuery);
    if (key === lastQueryKeyRef.current) return;
    lastQueryKeyRef.current = key;
    selectionApiRef.current.resetForQuery();
    if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
  }, [tableQuery]);

  // ===== 页码越界修正（至多一次）=====
  const correctedRef = useRef(false);
  useEffect(() => {
    if (!ready || isFetching) return;
    if (
      rows.length === 0 &&
      total > 0 &&
      tableQuery.page > 1 &&
      !correctedRef.current
    ) {
      correctedRef.current = true;
      update(
        { page: Math.max(1, Math.ceil(total / tableQuery.pageSize)) },
        'pageCorrection',
      );
      return;
    }
    if (rows.length > 0 || total === 0) correctedRef.current = false;
  }, [
    ready,
    isFetching,
    rows.length,
    total,
    tableQuery.page,
    tableQuery.pageSize,
    update,
  ]);

  // ===== 派生列能力（纯函数）=====
  const filterFields = useMemo(() => filterableFields(columns), [columns]);
  const sortableFields = useMemo<SortableField[]>(
    () =>
      columns
        .filter((column) => column.sortable)
        .map((column) => ({
          id: column.id,
          header: column.header,
          icon: column.icon,
          kind: column.valueKind ?? column.filter?.kind ?? 'text',
        })),
    [columns],
  );
  const maxSortRules = deriveMaxSortRules(toolbar);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState<number>(Infinity);
  useEffect(() => {
    const element = scrollContainerRef.current;
    if (isMobile || !element) return;
    const measure = () => {
      if (element.clientWidth) setViewportWidth(element.clientWidth);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, [isMobile]);
  const settableColumns = useMemo(
    () => deriveSettableColumns(columns),
    [columns],
  );
  const renderColumns = useMemo<
    import('../parts/data-table').RenderColumn<T>[]
  >(
    () =>
      deriveRenderColumns({
        columns,
        columnState,
        isRailBand,
        availableWidth: viewportWidth,
        pinnedActionsWidth: layout?.pinActions && actions.length ? 120 : 0,
      }),
    [
      columns,
      columnState,
      isRailBand,
      viewportWidth,
      layout?.pinActions,
      actions.length,
    ],
  );

  // ===== 拖拽重排 =====
  const drag = useColumnDrag({
    order: effectiveColumnOrder(columnState),
    scrollContainerRef,
    headerHeight: DRAG_HEADER_HEIGHT,
    onReorder: (sourceId, insertionIndex) => {
      updateColumns((draft) => {
        const visible = effectiveColumnOrder(draft).filter(
          (id) => id !== sourceId,
        );
        const target = visible[insertionIndex];
        const frozenCount = draft.frozen.filter(
          (id) => id !== sourceId && !draft.hidden.includes(id),
        ).length;
        const wasFrozen = draft.frozen.includes(sourceId);
        const freeze =
          insertionIndex < frozenCount ||
          (wasFrozen && insertionIndex === frozenCount);
        const source = columns.find((column) => column.id === sourceId);
        if (freeze && !wasFrozen && source?.freezable === false) return;
        const width = columns
          .filter(
            (column) =>
              draft.frozen.includes(column.id) &&
              !draft.hidden.includes(column.id),
          )
          .reduce(
            (sum, column) =>
              sum + (draft.widths[column.id] ?? column.width ?? 160),
            0,
          );
        if (
          freeze &&
          !wasFrozen &&
          viewportWidth -
            width -
            (draft.widths[sourceId] ?? source?.width ?? 160) -
            (layout?.pinActions && actions.length ? 120 : 0) <
            240
        )
          return;
        draft.order = draft.order.filter((id) => id !== sourceId);
        draft.order.splice(
          target ? draft.order.indexOf(target) : draft.order.length,
          0,
          sourceId,
        );
        draft.frozen = draft.frozen.filter((id) => id !== sourceId);
        if (freeze) {
          const freezeIndex = target ? draft.frozen.indexOf(target) : -1;
          draft.frozen.splice(
            freezeIndex < 0 ? draft.frozen.length : freezeIndex,
            0,
            sourceId,
          );
        }
      }, 'reorder' as ColumnStateReason);
    },
  });

  // ===== 冻结约束 / 列设置抽屉 =====
  const columnSettings = useColumnSettings({
    id,
    columns,
    columnState,
    renderColumns,
    updateColumns,
    resetColumns,
    pinActions: layout?.pinActions ?? false,
    hasRowActions: actions.length > 0,
    scrollContainerRef,
  });

  // ===== 视图/批量动作闭包 =====
  const queryControl = useMemo(
    () => ({
      query: tableQuery,
      refresh: async () => {
        await refetch();
      },
      resetQuery: () => replace(initialQuery, 'reset'),
    }),
    [tableQuery, refetch, replace, initialQuery],
  );
  const { viewActionItems, bulkActionItems, selectedRows } =
    useTableActionItems<T>({
      toolbarActions: toolbar.actions ?? [],
      selectionActions: selection?.actions,
      queryControl,
      actionsApi,
      rows,
      rowKey,
      selectedIds: selectionApiRef.current.selectedIds,
      isTransition,
    });

  return {
    isMobile,
    isRailBand,
    selectionEnabled,
    initialQuery,
    tableQuery,
    ready,
    update,
    replace,
    scopeEpoch,
    columnState,
    updateColumns,
    resetColumns,
    actionsApi,
    rows,
    total,
    meta,
    isPending,
    isFetching,
    isTransition,
    error,
    refetch,
    selectionApiRef,
    filterFields,
    sortableFields,
    maxSortRules,
    settableColumns,
    renderColumns,
    scrollContainerRef,
    drag,
    columnSettings,
    queryControl,
    viewActionItems,
    bulkActionItems,
    selectedRows,
  };
}
