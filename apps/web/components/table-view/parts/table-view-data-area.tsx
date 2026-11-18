'use client';

import type { RowAction, TableViewColumn } from '../types';
import { ActionCell } from './action-cell';
import { CheckboxOverlay } from './checkbox-overlay';
import {
  DataTable,
  type RenderColumn,
  type TableViewStatus,
} from './data-table';
import { TableCards } from './table-cards';
import { TableStatusContent } from './table-status-content';

/** 数据区渲染输入（TableView 组装后传入；选择/动作/过渡语义在组件内聚）。 */
export type TableViewDataAreaProps<T> = {
  /** 是否采用窄屏卡片布局。 */
  isMobile: boolean;
  /** 本次查询或交互对应的行数据集合。 */
  rows: T[];
  /** 提取行的稳定主键，供选择和渲染复用。 */
  rowKey: (row: T) => string;
  /** 窄屏卡片使用的业务列。 */
  cardColumns: TableViewColumn<T>[];
  /** 实际参与表格渲染的列及尺寸信息。 */
  renderColumns: RenderColumn<T>[];
  /** 当前页已选择的行标识。 */
  selectedIds: readonly string[];
  /** 是否启用当前页行选择。 */
  selectionEnabled: boolean;
  /** 是否处于保留旧数据的切换过程。 */
  isTransition: boolean;
  /** 当前上下文可用的动作配置。 */
  actions: RowAction<T>[];
  /** 是否有动作正在执行。 */
  actionsPending: boolean;
  /** 是否将操作列固定在滚动区域右侧。 */
  pinActions: boolean;
  /** 列拖拽状态与交互回调。 */
  drag: {
    /** 列拖拽状态与交互回调。 */
    drag: import('./data-table').DragView;
    /** 移动指针时更新拖拽位置。 */
    onPointerMove: (event: React.PointerEvent) => void;
    /** 释放指针时提交或结束拖拽。 */
    onPointerUp: (event: React.PointerEvent) => void;
    /** 按下列把手时准备拖拽。 */
    onPointerDown: (id: string, event: React.PointerEvent) => void;
    /** 处理键盘拖拽命令。 */
    onKeyDown: (id: string, event: React.KeyboardEvent) => void;
  };
  /** 点击行主体时触发；未提供时不附加行点击行为。 */
  onRowClick?: (row: T) => void;
  /** 执行指定行对应的业务动作。 */
  onRunRowAction: (row: T, action: RowAction<T>) => void;
  /** 切换指定行的选择状态。 */
  onToggleRow: (id: string) => void;
  /** 切换当前页全部可选行的选择状态。 */
  onToggleAll: () => void;
  /** 列宽调整完成时提交新宽度，单位 px。 */
  onResizeCommit: (id: string, width: number) => void;
  /** 恢复指定列的默认宽度。 */
  onResizeReset: (id: string) => void;
  /** 表格滚动容器引用，用于测量和滚动同步。 */
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  /** 当前业务状态，用于展示和后续操作判定。 */
  status: TableViewStatus;
  /** 是否采用随内容流动的布局模式。 */
  flow?: boolean;
};

/** 数据区：≥768 表格 + checkbox overlay，<768 卡片；过渡禁用交互。 */
export function TableViewDataArea<T>(props: TableViewDataAreaProps<T>) {
  const {
    isMobile,
    rows,
    rowKey,
    cardColumns,
    renderColumns,
    selectedIds,
    selectionEnabled,
    isTransition,
    actions,
    actionsPending,
    pinActions,
    drag,
    onRowClick,
    onRunRowAction,
    onToggleRow,
    onToggleAll,
    onResizeCommit,
    onResizeReset,
    scrollContainerRef,
    status,
  } = props;

  const actionsDisabled = isTransition || actionsPending;

  const overlay = selectionEnabled ? (
    <CheckboxOverlay
      rows={rows}
      rowKey={rowKey}
      scrollContainerRef={scrollContainerRef}
      selectedIds={selectedIds}
      disabled={isTransition}
      headerChecked={rows.length > 0 && selectedIds.length === rows.length}
      headerIndeterminate={
        selectedIds.length > 0 && selectedIds.length < rows.length
      }
      onToggleAll={onToggleAll}
      onToggleRow={onToggleRow}
    />
  ) : null;

  const actionsColumn =
    actions.length > 0 && !isMobile
      ? {
          disabled: actionsDisabled,
          render: (row: T) => (
            <ActionCell
              row={row}
              actions={actions}
              disabled={actionsDisabled}
              onRun={onRunRowAction}
            />
          ),
        }
      : undefined;

  if (isMobile && status.kind !== 'ready') {
    return (
      <div className="min-h-0 overflow-auto">
        <TableStatusContent status={status} />
      </div>
    );
  }
  if (isMobile) {
    return (
      <TableCards
        columns={cardColumns}
        rows={rows}
        rowKey={rowKey}
        selectedIds={selectedIds}
        actions={
          actions.length > 0
            ? {
                disabled: actionsDisabled,
                render: (row: T) => (
                  <ActionCell
                    row={row}
                    actions={actions}
                    disabled={actionsDisabled}
                    onRun={onRunRowAction}
                  />
                ),
              }
            : undefined
        }
        disabled={isTransition}
        onRowClick={onRowClick}
        onToggleRow={selectionEnabled ? onToggleRow : undefined}
      />
    );
  }

  return (
    <DataTable
      columns={renderColumns}
      flow={props.flow}
      actionsColumn={actionsColumn}
      rows={rows}
      rowKey={rowKey}
      selection={
        selectionEnabled
          ? { isRowSelected: (rowId) => selectedIds.includes(rowId) }
          : null
      }
      status={status}
      pinActions={pinActions}
      drag={drag}
      onRowClick={onRowClick}
      onResizeCommit={onResizeCommit}
      onResizeReset={onResizeReset}
      scrollContainerRef={scrollContainerRef}
      overlaySlot={overlay}
    />
  );
}
