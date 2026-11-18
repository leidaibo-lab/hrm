import type { ColumnState, TableViewColumn } from '../types';

/**
 * 列状态纯函数：默认状态、存储状态合并（损坏过滤/新列追加/删除列清理）。
 * 主列默认不可隐藏；merge 不触发查询（列布局改变不发查询、不清选择）。
 */

/** 列状态存储 schema 基础校验（zod 在 use-table-preferences 中组合版本号）。 */

/** 列工厂初值状态：按声明顺序、无宽度覆盖、全显示、无冻结。 */
export function defaultColumnState<T>(
  columns: TableViewColumn<T>[],
): ColumnState {
  return {
    order: columns.map((column) => column.id),
    widths: {},
    hidden: [],
    frozen: [],
  };
}

/**
 * 合并存储偏好与列定义：
 * - 损坏项过滤（未知列 id、非正数宽度）
 * - 删除列清理、新列追加到末尾（保持相对顺序）
 * - 主列强制可见（默认不可隐藏）
 * - 冻结区只保留仍存在的可冻结列
 */
export function mergeColumnState<T>(
  columns: TableViewColumn<T>[],
  saved: Partial<ColumnState>,
): ColumnState {
  const byId = new Map(columns.map((column) => [column.id, column]));
  const known = (id: string): boolean => byId.has(id);

  const savedOrder = Array.isArray(saved.order)
    ? [...new Set(saved.order.filter(known))]
    : [];
  const appended = columns
    .map((column) => column.id)
    .filter((id) => !savedOrder.includes(id));
  const order = [...savedOrder, ...appended];

  const widths: Record<string, number> = {};
  if (saved.widths && typeof saved.widths === 'object') {
    for (const [id, width] of Object.entries(saved.widths)) {
      if (known(id) && typeof width === 'number' && width > 0) {
        const column = byId.get(id);
        widths[id] = Math.min(
          column?.maxWidth ?? Infinity,
          Math.max(column?.minWidth ?? 96, width),
        );
      }
    }
  }

  const hiddenList = Array.isArray(saved.hidden)
    ? saved.hidden.filter(known)
    : [];
  // 主列默认不可隐藏（与列工厂 hideable 默认一致）：显式声明优先。
  const hideable = (id: string): boolean => {
    const column = byId.get(id);
    if (!column) return true;
    return column.hideable ?? !column.primary;
  };
  const hidden = [...new Set(hiddenList)].filter(hideable);

  const frozenList = Array.isArray(saved.frozen)
    ? saved.frozen.filter(known)
    : [];
  const frozen = [...new Set(frozenList)].filter(
    (id) => byId.get(id)?.freezable ?? true,
  );

  return { order, widths, hidden, frozen };
}

/** 计算实际生效列序：order 剔除 hidden；冻结区（保持声明顺序）在前、普通区在后。 */
export function effectiveColumnOrder(state: ColumnState): string[] {
  const visible = state.order.filter((id) => !state.hidden.includes(id));
  const frozen = state.frozen.filter((id) => visible.includes(id));
  const rest = visible.filter((id) => !frozen.includes(id));
  return [...frozen, ...rest];
}

/** 冻结约束：冻结区+右侧固定操作列计入视口占用时，普通数据区至少保留 240px。 */
export function canFreezeColumn(
  state: ColumnState,
  columnWidth: (id: string) => number,
  availableWidth: number,
  pinnedActionsWidth: number,
  candidateId: string,
): boolean {
  const frozenIds = state.frozen.includes(candidateId)
    ? state.frozen
    : [...state.frozen, candidateId];
  const frozenWidth = frozenIds.reduce((sum, id) => sum + columnWidth(id), 0);
  return availableWidth - frozenWidth - pinnedActionsWidth >= 240;
}
