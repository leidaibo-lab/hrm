'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SelectionReason } from '../types';

/**
 * 当前页选择：仅当前页选择，不跨页；数据落地后清理不在当前页的 id；
 * 动作目标在动作开始时捕获，数组变化不改变已开始动作的目标。
 */
export function useTableSelection<T>(config: {
  rows: T[];
  rowKey: (row: T) => string;
  enabled: boolean;
  partitionKey?: string;
  onSelectionChange?: (event: {
    ids: string[];
    rows: T[];
    reason: SelectionReason;
  }) => void;
}): {
  selectedIds: string[];
  selectedRows: T[];
  toggleRow: (id: string) => void;
  toggleAll: () => void;
  clear: (reason?: SelectionReason) => void;
  /** 批量动作成功项取消选中（reason 'action'）。 */
  settleAction: (succeededIds: string[]) => void;
  /** 通知查询条件变化：清空选择（保留 scope 语义由调用方传入）。 */
  resetForQuery: () => void;
  resetForScope: () => void;
} {
  const { rows, rowKey, enabled, onSelectionChange } = config;
  const [selection, setSelection] = useState({
    key: config.partitionKey,
    ids: [] as string[],
  });
  const selectedIds =
    selection.key === config.partitionKey ? selection.ids : [];
  const setSelectedIds = useCallback(
    (ids: string[]) => setSelection({ key: config.partitionKey, ids }),
    [config.partitionKey],
  );
  const idsRef = useRef<string[]>([]);

  const emit = useCallback(
    (ids: string[], reason: SelectionReason) => {
      idsRef.current = ids;
      if (!enabled) return;
      const selected = rows.filter((row) => ids.includes(rowKey(row)));
      try {
        onSelectionChange?.({ ids, rows: selected, reason });
      } catch (cause) {
        console.error('onSelectionChange 回调异常', cause);
      }
    },
    [enabled, onSelectionChange, rowKey, rows],
  );

  const apply = useCallback(
    (next: string[], reason: SelectionReason) => {
      const unique = [...new Set(next)];
      if (JSON.stringify(unique) === JSON.stringify(idsRef.current)) return;
      setSelectedIds(unique);
      emit(unique, reason);
    },
    [emit, setSelectedIds],
  );

  // 数据落地后清理不在当前页的 id（reason 'data'，仅当存在过期项）。
  const rowKeys = useMemo(() => rows.map((row) => rowKey(row)), [rows, rowKey]);
  useEffect(() => {
    const stale = selectedIds.filter((id) => !rowKeys.includes(id));
    if (stale.length > 0) {
      const next = selectedIds.filter((id) => rowKeys.includes(id));
      setSelectedIds(next);
      emit(next, 'data');
    }
  }, [rowKeys, selectedIds, emit, setSelectedIds]);

  const toggleRow = useCallback(
    (id: string) => {
      const next = selectedIds.includes(id)
        ? selectedIds.filter((item) => item !== id)
        : [...selectedIds, id];
      apply(next, 'row');
    },
    [apply, selectedIds],
  );

  const toggleAll = useCallback(() => {
    const next =
      selectedIds.length === rowKeys.length && rowKeys.length > 0
        ? []
        : [...rowKeys];
    apply(next, 'all');
  }, [apply, rowKeys, selectedIds.length]);

  const clear = useCallback(
    (reason: SelectionReason = 'clear') => {
      apply([], reason);
    },
    [apply],
  );

  const settleAction = useCallback(
    (succeededIds: string[]) => {
      const settled = new Set(succeededIds);
      apply(
        selectedIds.filter((id) => !settled.has(id)),
        'action',
      );
    },
    [apply, selectedIds],
  );

  const resetForQuery = useCallback(() => apply([], 'query'), [apply]);
  const resetForScope = useCallback(() => apply([], 'scope'), [apply]);

  useEffect(() => {
    if (!enabled) apply([], 'clear');
  }, [enabled, apply]);

  return {
    selectedIds,
    selectedRows: rows.filter((row) => selectedIds.includes(rowKey(row))),
    toggleRow,
    toggleAll,
    clear,
    settleAction,
    resetForQuery,
    resetForScope,
  };
}
