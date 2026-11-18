'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  type ColumnSettingItem,
  ColumnSettingsDrawer,
} from '../parts/column-settings-drawer';
import type { RenderColumn } from '../parts/data-table';
import type {
  ColumnStateReason,
  TableViewColumn,
  ToolbarConfig,
} from '../types';

const MIN_VIEWPORT_RESERVE = 240;
const PINNED_ACTIONS_WIDTH = 120;

/**
 * 列设置抽屉的条目派生与回调：显示/冻结/排序即时生效并持久化；
 * 显式新增冻结前保证普通数据区至少保留 240px（右侧固定操作列宽度计入）。
 */
export function useColumnSettings<T>(config: {
  id: string;
  columns: TableViewColumn<T>[];
  columnState: import('../types').ColumnState;
  renderColumns: RenderColumn<T>[];
  updateColumns: (
    mutate: (draft: import('../types').ColumnState) => void,
    reason: ColumnStateReason,
  ) => void;
  resetColumns: () => void;
  pinActions: boolean;
  hasRowActions: boolean;
  /** 数据区滚动容器：冻结约束按其可见宽度计算。 */
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}): {
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  drawer: React.ReactNode;
  tryFreeze: (columnId: string) => boolean;
} {
  const {
    id,
    columns,
    columnState,
    renderColumns,
    updateColumns,
    resetColumns,
    pinActions,
    hasRowActions,
    scrollContainerRef,
  } = config;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);

  const columnWidthOf = useCallback(
    (columnId: string) =>
      renderColumns.find((item) => item.id === columnId)?.width ?? 160,
    [renderColumns],
  );

  const tryFreeze = useCallback(
    (columnId: string): boolean => {
      const available =
        scrollContainerRef.current?.clientWidth || window.innerWidth - 48;
      const pinnedActionsWidth =
        pinActions && hasRowActions ? PINNED_ACTIONS_WIDTH : 0;
      const frozenWidth = columnState.frozen
        .filter((id) => !columnState.hidden.includes(id))
        .reduce((sum, frozenId) => sum + columnWidthOf(frozenId), 0);
      const candidateWidth = columnWidthOf(columnId);
      return (
        available - frozenWidth - candidateWidth - pinnedActionsWidth >=
        MIN_VIEWPORT_RESERVE
      );
    },
    [
      columnState.frozen,
      columnState.hidden,
      columnWidthOf,
      hasRowActions,
      pinActions,
      scrollContainerRef,
    ],
  );

  const buildItems = useCallback((): ColumnSettingItem[] => {
    const byId = new Map(columns.map((column) => [column.id, column]));
    const make = (columnId: string): ColumnSettingItem | null => {
      const column = byId.get(columnId);
      if (!column) return null;
      return {
        id: column.id,
        header: column.header,
        icon: column.icon,
        hideable: column.hideable ?? !column.primary,
        freezable: column.freezable ?? true,
        frozen: columnState.frozen.includes(column.id),
        visible: !columnState.hidden.includes(column.id),
        reorderable: column.reorderable ?? true,
      };
    };
    const frozenOrdered = columnState.frozen
      .map(make)
      .filter((item): item is ColumnSettingItem => item !== null);
    const order = columnState.order;
    const normalOrdered = order
      .filter((columnId) => !columnState.frozen.includes(columnId))
      .map(make)
      .filter((item): item is ColumnSettingItem => item !== null);
    return [...frozenOrdered, ...normalOrdered];
  }, [columns, columnState]);

  const items = useMemo(() => buildItems(), [buildItems]);
  void id;

  const drawer = (
    <ColumnSettingsDrawer
      open={drawerOpen}
      onOpenChange={(open) => setDrawerOpen(open)}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        opener.current?.focus();
      }}
      items={items}
      onToggleVisible={(columnId) => {
        const column = columns.find((item) => item.id === columnId);
        if (!(column?.hideable ?? !column?.primary)) return;
        updateColumns((draft) => {
          if (draft.hidden.includes(columnId)) {
            draft.hidden = draft.hidden.filter((item) => item !== columnId);
          } else {
            draft.hidden = [...draft.hidden, columnId];
          }
        }, 'visibility');
      }}
      onToggleFreeze={(columnId) => {
        if (columns.find((item) => item.id === columnId)?.freezable === false)
          return;
        if (columnState.frozen.includes(columnId)) {
          updateColumns((draft) => {
            draft.frozen = draft.frozen.filter((item) => item !== columnId);
            draft.order = [
              columnId,
              ...draft.order.filter((item) => item !== columnId),
            ];
          }, 'freeze');
          return;
        }
        if (!tryFreeze(columnId)) {
          toast.info('可视区域不足，请先取消其他冻结列');
          return;
        }
        updateColumns((draft) => {
          draft.frozen = [...draft.frozen, columnId];
          draft.hidden = draft.hidden.filter((item) => item !== columnId);
        }, 'freeze');
      }}
      onMove={(columnId, direction) => {
        if (columns.find((item) => item.id === columnId)?.reorderable === false)
          return;
        updateColumns((draft) => {
          const frozen = draft.frozen.includes(columnId);
          const group = frozen
            ? [...draft.frozen]
            : draft.order.filter((id) => !draft.frozen.includes(id));
          const from = group.indexOf(columnId);
          const to = from + direction;
          if (to < 0 || to >= group.length) return;
          const [moved] = group.splice(from, 1);
          group.splice(to, 0, moved);
          if (frozen) draft.frozen = group;
          else draft.order = [...draft.frozen, ...group];
        }, 'reorder');
      }}
      onReorder={(sourceId, targetId) => {
        const source = columns.find((column) => column.id === sourceId);
        if (sourceId === targetId || source?.reorderable === false) return;
        const freeze = columnState.frozen.includes(targetId);
        if (freeze && !columnState.frozen.includes(sourceId)) {
          if (source?.freezable === false) return;
          if (!tryFreeze(sourceId)) {
            toast.info('可视区域不足，请先取消其他冻结列');
            return;
          }
        }
        updateColumns((draft) => {
          draft.order = draft.order.filter((id) => id !== sourceId);
          draft.order.splice(draft.order.indexOf(targetId), 0, sourceId);
          draft.frozen = draft.frozen.filter((id) => id !== sourceId);
          if (freeze)
            draft.frozen.splice(draft.frozen.indexOf(targetId), 0, sourceId);
        }, 'reorder');
      }}
      onReset={resetColumns}
    />
  );

  return {
    drawerOpen,
    openDrawer: () => {
      opener.current = document.activeElement as HTMLElement | null;
      setDrawerOpen(true);
    },
    closeDrawer: () => setDrawerOpen(false),
    drawer,
    tryFreeze,
  };
}

/** toolbar 类型引用保留（抽屉回调与入口显隐共享同一配置来源）。 */
export type { ToolbarConfig };
