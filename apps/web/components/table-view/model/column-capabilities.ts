'use client';

import { effectiveColumnOrder } from '../model/normalize-columns';
import type { RenderColumn } from '../parts/data-table';
import type { ColumnState, TableViewColumn, ToolbarConfig } from '../types';

/** 列能力派生结果（TableView 消费；按表格固定入参纯计算）。 */
export type ColumnCapabilities<T> = {
  /** 实际参与表格渲染的列及尺寸信息。 */
  renderColumns: RenderColumn<T>[];
  /** 允许用户通过列设置调整的列。 */
  settableColumns: TableViewColumn<T>[];
  /** 按稳定列标识取得当前有效宽度，单位 px。 */
  columnWidthOf: (id: string) => number;
};

/**
 * 生效列序：偏好合并 → 剔除隐藏与次要列（icon rail 档）→ 冻结偏移累计。
 * 列布局变化只影响本派生，不发查询、不清选择。
 */
export function deriveRenderColumns<T>(config: {
  columns: TableViewColumn<T>[];
  columnState: ColumnState;
  isRailBand: boolean;
  /** checkbox overlay 占位宽度（冻结列 sticky 偏移需叠加，避免被遮挡）。 */
  overlayWidth?: number;
  availableWidth?: number;
  pinnedActionsWidth?: number;
}): RenderColumn<T>[] {
  const { columns, columnState, isRailBand, overlayWidth = 0 } = config;
  const order = effectiveColumnOrder(columnState);
  const visible = order
    .map((cid) => columns.find((column) => column.id === cid))
    .filter((column): column is TableViewColumn<T> => Boolean(column))
    .filter((column) => !(column.secondary && isRailBand));
  const frozenSet = new Set<string>();
  let remaining =
    (config.availableWidth ?? Infinity) -
    (config.pinnedActionsWidth ?? 0) -
    240;
  for (const column of visible) {
    if (!columnState.frozen.includes(column.id)) continue;
    const width = columnState.widths[column.id] ?? column.width ?? 160;
    if (width > remaining) break;
    frozenSet.add(column.id);
    remaining -= width;
  }
  let frozenOffset = overlayWidth;
  return visible.map((column) => {
    const frozen = frozenSet.has(column.id);
    const renderColumn: RenderColumn<T> = {
      column,
      id: column.id,
      width: columnState.widths[column.id] ?? column.width ?? 160,
      frozen,
      frozenOffset: frozen ? frozenOffset : 0,
    };
    if (frozen) frozenOffset += renderColumn.width;
    return renderColumn;
  });
}

/** 有任何列能力（隐藏/冻结/重排）可设置时才显示列设置入口。 */
export function deriveSettableColumns<T>(
  columns: TableViewColumn<T>[],
): TableViewColumn<T>[] {
  return columns.filter(
    (column) =>
      (column.hideable ?? !column.primary) ||
      (column.freezable ?? true) ||
      (column.reorderable ?? true),
  );
}

/** toolbar 排序上限（sortable: { maxRules }）。 */
export function deriveMaxSortRules(toolbar: ToolbarConfig): number {
  return typeof toolbar.sortable === 'object'
    ? (toolbar.sortable.maxRules ?? 5)
    : 5;
}
