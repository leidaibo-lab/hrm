'use client';

import { useCallback, useMemo, useRef } from 'react';
import { z } from 'zod';
import { useLocalStorage } from '@/hooks/use-local-storage';
import {
  defaultColumnState,
  mergeColumnState,
} from '../model/normalize-columns';
import { tableScopeKey } from '../model/scope-key';
import type { ColumnState, ColumnStateReason, TableViewColumn } from '../types';

/** 列状态存储形态（schema 有版本；损坏项过滤）。 */
const columnStateStorageSchema = z.object({
  version: z.literal(1),
  order: z.array(z.string()),
  widths: z.record(z.string(), z.number()),
  hidden: z.array(z.string()),
  frozen: z.array(z.string()),
});

/**
 * 列偏好：order/widths/hidden/frozen 存 localStorage；
 * reset 删除存储并恢复列 factory 初值；布局变化不发查询、不清选择。
 */
export function useTablePreferences(config: {
  id: string;
  identityKey: string;
  scope?: import('../types').TableScope;
  columns: TableViewColumn<unknown>[];
  onColumnStateChange?: (event: {
    previous: ColumnState;
    next: ColumnState;
    reason: ColumnStateReason;
  }) => void;
}): {
  state: ColumnState;
  ready: boolean;
  update: (
    mutate: (draft: ColumnState) => void,
    reason: ColumnStateReason,
  ) => void;
  reset: () => void;
} {
  const { id, identityKey, onColumnStateChange } = config;

  const initial = useMemo(
    () => defaultColumnState(config.columns),
    [config.columns],
  );

  const storage = useLocalStorage<{ version: 1 } & ColumnState>({
    key: `tv:cols:v1:${identityKey}:${id}:${tableScopeKey(config.scope)}`,
    schema: columnStateStorageSchema,
    defaultValue: { version: 1, ...initial },
  });

  const state = useMemo(() => {
    if (!storage.ready) return initial;
    const parsed = columnStateStorageSchema.safeParse(storage.value);
    return mergeColumnState(
      config.columns,
      parsed.success ? parsed.data : initial,
    );
  }, [storage.ready, storage.value, config.columns, initial]);

  const lastRef = useRef<ColumnState>(state);
  lastRef.current = state;

  const emit = useCallback(
    (previous: ColumnState, next: ColumnState, reason: ColumnStateReason) => {
      lastRef.current = next;
      try {
        onColumnStateChange?.({ previous, next, reason });
      } catch (cause) {
        console.error('onColumnStateChange 回调异常', cause);
      }
    },
    [onColumnStateChange],
  );

  const update = useCallback(
    (mutate: (draft: ColumnState) => void, reason: ColumnStateReason) => {
      const previous = lastRef.current;
      const draft: ColumnState = {
        order: [...previous.order],
        widths: { ...previous.widths },
        hidden: [...previous.hidden],
        frozen: [...previous.frozen],
      };
      mutate(draft);
      const next = mergeColumnState(config.columns, draft);
      if (JSON.stringify(previous) === JSON.stringify(next)) return;
      storage.setValue({ version: 1, ...next });
      emit(previous, next, reason);
    },
    [config.columns, emit, storage],
  );

  const reset = useCallback(() => {
    const previous = lastRef.current;
    storage.reset();
    emit(previous, initial, 'reset');
  }, [emit, initial, storage]);

  return { state, ready: storage.ready, update, reset };
}
