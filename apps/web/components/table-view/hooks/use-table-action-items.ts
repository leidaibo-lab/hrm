'use client';

import { useMemo } from 'react';
import { actionKey } from '../model/action-key';
import type { ToolbarActionItem } from '../parts/view-bar';
import type { TableViewProps, ViewAction } from '../types';
import type { useTableActions } from './use-table-actions';

/**
 * 视图/批量动作 → 工具栏条目闭包：
 * 权限由业务先过滤，enabled 在此处消费；目标在动作开始时由 actionsApi 捕获。
 */
export function useTableActionItems<T>(config: {
  toolbarActions: ViewAction[];
  selectionActions: NonNullable<TableViewProps<T>['selection']>['actions'];
  queryControl: {
    query: import('../types').TableQuery;
    refresh: () => Promise<void>;
    resetQuery: () => void;
  };
  actionsApi: ReturnType<typeof useTableActions<T>>;
  rows: T[];
  rowKey: (row: T) => string;
  selectedIds: readonly string[];
  isTransition: boolean;
}): {
  viewActionItems: ToolbarActionItem[];
  bulkActionItems: ToolbarActionItem[];
  selectedRows: T[];
} {
  const {
    toolbarActions,
    selectionActions,
    queryControl,
    actionsApi,
    rows,
    rowKey,
    selectedIds,
    isTransition,
  } = config;

  const viewActionItems = useMemo(
    () =>
      toolbarActions.map((action) => ({
        key: actionKey(action),
        label: action.label,
        danger: action.danger,
        disabled:
          actionsApi.pending !== null ||
          !(action.enabled?.(queryControl) ?? true),
        onSelect: () => {
          void actionsApi.runAction({
            label: action.label,
            targetIds: [],
            danger: action.danger,
            confirm: action.confirm,
            execute: () =>
              Promise.resolve(
                action.onRun({
                  query: queryControl.query,
                  refresh: queryControl.refresh,
                  resetQuery: queryControl.resetQuery,
                }),
              ),
          });
        },
      })),
    [toolbarActions, queryControl, actionsApi],
  );

  const selectedRows = useMemo(
    () => rows.filter((row) => selectedIds.includes(rowKey(row))),
    [rows, selectedIds, rowKey],
  );

  const bulkActionItems = useMemo(
    () =>
      (selectionActions ?? []).map((action) => ({
        key: actionKey(action),
        label: action.label,
        danger: action.danger,
        disabled:
          actionsApi.pending !== null ||
          isTransition ||
          selectedRows.length === 0 ||
          !(action.enabled?.(selectedRows) ?? true),
        onSelect: () => {
          // 目标在动作开始时捕获（动作内部持有快照）。
          void actionsApi.runBulkAction(selectedRows, action);
        },
      })),
    [selectionActions, selectedRows, isTransition, actionsApi],
  );

  return { viewActionItems, bulkActionItems, selectedRows };
}
