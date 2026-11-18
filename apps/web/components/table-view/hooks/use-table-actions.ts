'use client';

import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import type {
  ActionErrorEvent,
  ActionEvent,
  BulkAction,
  BulkResult,
  RowAction,
  TableError,
} from '../types';

/** 确认弹层状态：run 在确认时执行（目标在请求时已捕获）。 */
export type PendingConfirm<T> = {
  /** 展示给用户的动作或选项名称。 */
  label: string;
  /** 界面标题；未提供时由所在组件使用默认标题。 */
  title: string;
  /** 供界面展示的补充说明。 */
  description?: string;
  /** 确认按钮的展示文案。 */
  confirmLabel: string;
  /** 取消按钮的展示文案。 */
  cancelLabel: string;
  /** 是否以危险操作样式提示用户。 */
  danger: boolean;
  /** 执行已确认的动作并报告异步失败。 */
  run: () => Promise<void>;
  /** 动作开始时捕获的目标上下文。 */
  context?: {
    /** 本次交互对应的行数据。 */
    row?: T;
    /** 本次查询或交互对应的行数据集合。 */
    rows?: readonly T[];
  };
};

/** 进行中动作：绑定本次执行与固定目标。 */
export type PendingAction = {
  /** 展示给用户的动作或选项名称。 */
  label: string;
  /** 动作开始时捕获的目标标识，执行期间不随选择变化。 */
  targetIds: string[];
};

/** 动作执行语义共用：pending 绑定动作实例与捕获目标，不转移。 */
export function useTableActions<T>(config: {
  rowKey: (row: T) => string;
  onSettle?: (succeededIds: string[]) => void;
  onActionStart?: (event: ActionEvent) => void;
  onActionSuccess?: (event: ActionEvent) => void;
  onActionError?: (event: ActionErrorEvent) => void;
}): {
  pending: PendingAction | null;
  confirm: PendingConfirm<T> | null;
  bulkFailures: Array<{ id: string; error: TableError }> | null;
  dismissBulkFailures: () => void;
  requestConfirm: (candidate: PendingConfirm<T>) => void;
  cancelConfirm: () => void;
  runAction: (params: {
    label: string;
    targetIds: string[];
    scope?: 'view' | 'row' | 'bulk';
    danger?: boolean;
    confirm?: RowAction<T>['confirm'];
    execute: () => Promise<unknown> | unknown;
  }) => Promise<void>;
  runRowAction: (row: T, action: RowAction<T>) => Promise<void>;
  runBulkAction: (rows: readonly T[], action: BulkAction<T>) => Promise<void>;
} {
  const { rowKey, onSettle, onActionStart, onActionSuccess, onActionError } =
    config;
  const running = useRef(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [confirm, setConfirm] = useState<PendingConfirm<T> | null>(null);
  const [bulkFailures, setBulkFailures] = useState<Array<{
    id: string;
    error: TableError;
  }> | null>(null);

  const dismissBulkFailures = useCallback(() => setBulkFailures(null), []);
  const requestConfirm = useCallback(
    (candidate: PendingConfirm<T>) => setConfirm(candidate),
    [],
  );
  const cancelConfirm = useCallback(() => setConfirm(null), []);

  const toError = useCallback((cause: unknown): TableError => {
    const api = cause as TableError;
    if (api && typeof api === 'object' && 'code' in api) {
      return {
        message: api.message ?? '操作失败',
        code: api.code,
        status: api.status,
        traceId: api.traceId,
        errors: api.errors,
      };
    }
    return {
      message: cause instanceof Error ? cause.message : String(cause),
    };
  }, []);

  const runAction = useCallback(
    async (params: {
      label: string;
      targetIds: string[];
      scope?: 'view' | 'row' | 'bulk';
      danger?: boolean;
      confirm?: RowAction<T>['confirm'];
      execute: () => Promise<unknown> | unknown;
    }) => {
      const normalizeConfirm = (value: typeof params.confirm) =>
        typeof value === 'string' ? { title: value } : value;
      const confirmSpec = params.confirm
        ? normalizeConfirm(params.confirm)
        : undefined;
      const notify = (callback: (() => void) | undefined) => {
        try {
          callback?.();
        } catch (error) {
          console.error('TableView 动作回调异常', error);
        }
      };
      const event: ActionEvent = {
        label: params.label,
        scope: params.scope ?? 'view',
        rowIds: [...params.targetIds],
        action: { label: params.label, danger: params.danger },
      };
      const finish = async () => {
        if (running.current) return;
        running.current = true;
        setConfirm(null);
        setPending({ label: params.label, targetIds: params.targetIds });
        setBulkFailures(null);
        try {
          notify(() => onActionStart?.(event));
          const result: unknown = await params.execute();
          if (
            result &&
            typeof result === 'object' &&
            'succeededIds' in result &&
            'failed' in result
          ) {
            const partial = result as BulkResult;
            onSettle?.(partial.succeededIds);
            if (partial.failed.length > 0) {
              setBulkFailures(partial.failed);
              toast.error(`${partial.failed.length} 项操作失败`, {
                description: partial.failed
                  .map((item) => item.error.message)
                  .join('；'),
              });
            }
          }
          notify(() => onActionSuccess?.({ ...event, result }));
        } catch (cause) {
          const error = toError(cause);
          toast.error(error.message);
          notify(() => onActionError?.({ ...event, error }));
        } finally {
          running.current = false;
          setPending(null);
        }
      };
      if (confirmSpec) {
        setConfirm({
          label: params.label,
          title: confirmSpec.title ?? params.label,
          description: confirmSpec.description,
          confirmLabel: confirmSpec.confirmLabel ?? '确认',
          cancelLabel: confirmSpec.cancelLabel ?? '取消',
          danger: params.danger ?? false,
          run: () => finish().then(() => undefined),
        });
        return;
      }
      await finish();
    },
    [onActionError, onActionStart, onActionSuccess, onSettle, toError],
  );

  const runRowAction = useCallback(
    async (row: T, action: RowAction<T>) => {
      await runAction({
        label: action.label,
        targetIds: [rowKey(row)],
        scope: 'row',
        danger: action.danger,
        confirm: action.confirm,
        execute: () => Promise.resolve(action.onRun(row)),
      });
    },
    [rowKey, runAction],
  );

  const runBulkAction = useCallback(
    async (rows: readonly T[], action: BulkAction<T>) => {
      // 目标在动作开始时捕获（快照），选择变化不改变本次执行的目标。
      const targetIds = rows.map((row) => rowKey(row));
      const captured: readonly T[] = [...rows];
      await runAction({
        label: action.label,
        targetIds,
        scope: 'bulk',
        danger: action.danger,
        confirm: action.confirm,
        execute: async () => {
          const result = await action.onRun(captured);
          if (!result && action.selectionAfterRun === 'clear')
            onSettle?.(targetIds);
          return result;
        },
      });
    },
    [rowKey, runAction, onSettle],
  );

  return {
    pending,
    confirm,
    bulkFailures,
    dismissBulkFailures,
    requestConfirm,
    cancelConfirm,
    runAction,
    runRowAction,
    runBulkAction,
  };
}
