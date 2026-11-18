'use client';

import { ArrowUpNarrowWideIcon } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTableViewController } from './hooks/use-table-view-controller';
import { FilterBar } from './parts/filter-bar';
import { RowDetailDrawer } from './parts/row-detail-drawer';
import { SortPopover } from './parts/sort-popover';
import { TableFooter } from './parts/table-footer';
import { TableViewDataArea } from './parts/table-view-data-area';
import { deriveTableViewStatus } from './parts/table-view-status';
import { ViewBar } from './parts/view-bar';
import type {
  ColumnStateReason,
  TableViewHandle,
  TableViewProps,
} from './types';

const DEFAULT_SEARCH_DEBOUNCE = 300;

/**
 * TableView 组合：只读数据表格的通用视图。
 * 查询状态 sessionStorage、列偏好 localStorage、选择与拖拽草稿在内存；
 * 状态编排见 hooks/use-table-view-controller，数据区渲染见 parts/table-view-data-area。
 */
export function TableView<T, TMeta = unknown>(
  props: TableViewProps<T, TMeta> & { ref?: React.Ref<TableViewHandle> },
) {
  const { ref } = props;
  const {
    title,
    rowKey,
    columns,
    toolbar = {},
    actions = [],
    selection,
    layout,
    empty,
    renderMeta,
    renderRowDetail,
    onRowClick,
  } = props;
  const controller = useTableViewController<T, TMeta>({
    ...props,
    selectionEnabled: selection?.enabled ?? false,
  });
  const {
    isMobile,
    isRailBand,
    selectionEnabled,
    initialQuery,
    tableQuery,
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
  } = controller;

  // ===== toolbar 入口显隐 =====
  const searchEnabled = Boolean(toolbar.searchable);
  const filterEnabled = Boolean(toolbar.filterable) && filterFields.length > 0;
  const sortEnabled = Boolean(toolbar.sortable) && sortableFields.length > 0;
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const sortAnchorRef = useRef<HTMLButtonElement>(null);
  const [detailRow, setDetailRow] = useState<T | null>(null);
  const boundaryKey = `${props.identityKey}:${scopeEpoch}`;
  const previousBoundary = useRef(boundaryKey);
  useEffect(() => {
    if (boundaryKey === previousBoundary.current) return;
    previousBoundary.current = boundaryKey;
    setDetailRow(null);
    setFilterOpen(false);
    setSortOpen(false);
  }, [boundaryKey]);

  /** 行点击：onRowClick 优先，否则 renderRowDetail 打开抽屉。 */
  const handleRowClick = useCallback(
    (row: T) => {
      if (onRowClick) {
        onRowClick(row);
        return;
      }
      if (renderRowDetail) setDetailRow(row);
    },
    [onRowClick, renderRowDetail],
  );

  // ===== ref 句柄 =====
  useImperativeHandle(
    ref,
    (): TableViewHandle => ({
      refresh: async () => {
        await refetch();
      },
      resetQuery: () => replace(initialQuery, 'reset'),
      clearSelection: () => selectionApiRef.current.clear('clear'),
      resetColumns: () => resetColumns(),
      getQuery: () => tableQuery,
    }),
    [refetch, replace, initialQuery, resetColumns, tableQuery, selectionApiRef],
  );

  // ===== 布局（sticky footer / flow）=====
  const footerMode = layout?.footerMode ?? 'sticky';
  const rootRef = useRef<HTMLDivElement>(null);
  const [availableHeight, setAvailableHeight] = useState<number | null>(null);
  useEffect(() => {
    if (footerMode !== 'sticky') {
      setAvailableHeight(null);
      return;
    }
    const measure = () => {
      const element = rootRef.current;
      if (!element) return;
      const top = element.getBoundingClientRect().top;
      const declared = layout?.maxHeight;
      const height =
        declared === 'available' || declared === undefined
          ? Math.max(240, window.innerHeight - top)
          : declared;
      setAvailableHeight(height);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [footerMode, layout?.maxHeight]);

  // ===== 状态/空态推导 =====
  const clearSearchAndFilters = useCallback(() => {
    update({ q: '', filters: [] }, 'search');
  }, [update]);
  const tableStatus = deriveTableViewStatus<T>({
    isPending,
    error,
    refetch,
    rows,
    tableQuery,
    isTransition,
    empty,
    queryControl,
    clearSearchAndFilters,
    onEmptyAction: () => {
      if (!empty?.action) return;
      const action = empty.action;
      void actionsApi.runAction({
        label: action.label,
        targetIds: [],
        danger: action.danger,
        confirm: action.confirm,
        execute: () => action.onRun(queryControl),
      });
    },
  });

  /** 行动作执行闭包（注入数据区）。 */
  const runRowAction = useCallback(
    (row: T, action: Parameters<typeof actionsApi.runRowAction>[1]) => {
      void actionsApi.runRowAction(row, action);
    },
    [actionsApi],
  );

  const searchConfig =
    typeof toolbar.searchable === 'object' ? toolbar.searchable : {};

  return (
    <div
      ref={rootRef}
      className={cn(
        'flex min-h-0 min-w-0 flex-col px-7',
        footerMode === 'flow' && 'shrink-0',
      )}
      style={
        footerMode === 'sticky' && availableHeight !== null
          ? { maxHeight: availableHeight }
          : undefined
      }
      data-scope-epoch={scopeEpoch}
    >
      {!!renderMeta && (
        <div className="py-2">
          {renderMeta(meta, { fetching: isFetching, stale: isTransition })}
        </div>
      )}
      <ViewBar
        key={`${props.identityKey}:${scopeEpoch}`}
        fetching={isFetching && !isPending}
        title={title}
        searchable={searchEnabled}
        searchPlaceholder={searchConfig.placeholder}
        searchDebounceMs={searchConfig.debounceMs ?? DEFAULT_SEARCH_DEBOUNCE}
        q={tableQuery.q}
        onSearchCommit={(q) => {
          if (q !== tableQuery.q) {
            update({ q }, 'search');
            // 搜索条件实际变化时清空选择（保留展开与关键词）。
            selectionApiRef.current.resetForQuery();
          }
        }}
        onSearchClear={() => update({ q: '' }, 'search')}
        showFilterEntry={filterEnabled}
        filterActive={tableQuery.filters.length > 0}
        onFilterToggle={() => {
          setFilterOpen((open) => !open);
        }}
        sortTrigger={
          sortEnabled ? (
            <SortPopover
              fields={sortableFields}
              anchorRef={sortAnchorRef}
              sort={tableQuery.sort}
              maxRules={maxSortRules}
              onSortChange={(sort) => update({ sort }, 'sort')}
              open={sortOpen}
              onOpenChange={setSortOpen}
            >
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-8 shrink-0 text-[length:var(--text-meta)]',
                  tableQuery.sort.length > 0 && 'bg-tint text-primary',
                )}
                aria-label="排序"
              >
                <ArrowUpNarrowWideIcon className="size-4" />
                <span className="hidden sm:inline">排序</span>
              </Button>
            </SortPopover>
          ) : null
        }
        showColumnSettings={Boolean(toolbar.columnSettings)}
        hasSettableColumns={settableColumns.length > 0}
        onOpenColumnSettings={columnSettings.openDrawer}
        columnSettingsActive={columnSettings.drawerOpen}
        viewActions={viewActionItems}
        selection={
          selectionEnabled
            ? {
                active: selectionApiRef.current.selectedIds.length > 0,
                count: selectionApiRef.current.selectedIds.length,
                revision: JSON.stringify(selectionApiRef.current.selectedIds),
                disabled: isTransition,
                actions: bulkActionItems,
                onClear: (reason) =>
                  selectionApiRef.current.clear(reason ?? 'clear'),
              }
            : null
        }
        onExitSelection={() => selectionApiRef.current.clear('clear')}
      />

      {(filterOpen ||
        tableQuery.filters.length > 0 ||
        tableQuery.sort.length > 0) && (
        <FilterBar
          fields={filterEnabled ? filterFields : []}
          filters={tableQuery.filters}
          sort={tableQuery.sort}
          open={filterOpen}
          onOpenChange={setFilterOpen}
          onChange={(filters) => update({ filters }, 'filter')}
          sortLabel={
            columns.find((column) => column.id === tableQuery.sort[0]?.field)
              ?.header
          }
          sortAnchorRef={sortAnchorRef}
          onSortClick={() => setSortOpen(true)}
          onSortClear={() => update({ sort: [] }, 'sort')}
        />
      )}
      <TableViewDataArea
        flow={footerMode === 'flow'}
        isMobile={isMobile}
        rows={rows}
        rowKey={rowKey}
        cardColumns={columns.filter(
          (column) =>
            !columnState.hidden.includes(column.id) &&
            !(column.secondary && isRailBand),
        )}
        renderColumns={renderColumns}
        selectedIds={selectionApiRef.current.selectedIds}
        selectionEnabled={selectionEnabled}
        isTransition={isTransition}
        actions={actions}
        actionsPending={actionsApi.pending !== null}
        pinActions={layout?.pinActions ?? false}
        drag={drag}
        onRowClick={onRowClick || renderRowDetail ? handleRowClick : undefined}
        onRunRowAction={runRowAction}
        onToggleRow={(rowId) => selectionApiRef.current.toggleRow(rowId)}
        onToggleAll={() => selectionApiRef.current.toggleAll()}
        onResizeCommit={(columnId, width) =>
          updateColumns((draft) => {
            draft.widths[columnId] = width;
          }, 'resize' as ColumnStateReason)
        }
        onResizeReset={(columnId) =>
          updateColumns((draft) => {
            delete draft.widths[columnId];
          }, 'resize' as ColumnStateReason)
        }
        scrollContainerRef={scrollContainerRef}
        status={tableStatus}
      />
      <TableFooter
        page={tableQuery.page}
        pageCount={Math.max(1, Math.ceil(total / tableQuery.pageSize))}
        total={total}
        pageSize={tableQuery.pageSize}
        onPageChange={(page) => update({ page }, 'page')}
        onPageSizeChange={(pageSize) => update({ pageSize }, 'pageSize')}
      />
      {columnSettings.drawer}
      {!!actionsApi.confirm && (
        <ConfirmDialog
          open
          danger={actionsApi.confirm.danger}
          title={actionsApi.confirm.title}
          description={actionsApi.confirm.description}
          confirmLabel={actionsApi.confirm.confirmLabel}
          cancelLabel={actionsApi.confirm.cancelLabel}
          onOpenChange={(open) => {
            if (!open) actionsApi.cancelConfirm();
          }}
          onConfirm={() => void actionsApi.confirm?.run()}
        />
      )}
      {!!renderRowDetail && (
        <RowDetailDrawer row={detailRow} onClose={() => setDetailRow(null)}>
          {(row) => renderRowDetail({ row, close: () => setDetailRow(null) })}
        </RowDetailDrawer>
      )}
    </div>
  );
}
