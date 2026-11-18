'use client';

import { BoxIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  createColumns,
  createTableQuery,
  FilterOperator,
  option,
  type RowAction,
  SortDirection,
  TableView,
} from '@/components/table-view';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ModelRow } from '../../api/models';
import {
  queryModels,
  useRemoveModel,
  useSetModelEnabled,
} from '../../api/models';
import { capabilityBadges } from './capability';
import { CreateModelDialog } from './create-model-dialog';
import { ImportModelDialog } from './import-model-dialog';

const ENABLED_OPTIONS = {
  enabled: option.success('启用'),
  disabled: option.neutral('停用'),
};

/** 列工厂：displayName/logicalKey 搜索排序、enabled 投影筛选；scope 由 providerId 提供。 */
const modelColumns = createColumns<ModelRow>(({ primary, text, status }) => [
  primary('displayName', '模型', {
    sortable: true,
    width: 220,
    meta: (row) => row.modelId,
    cell: (row) => (
      <div className="grid gap-0.5">
        <Link
          className="w-fit font-medium hover:underline"
          href={`/admin/ai/providers/${row.providerId}/models/${row.id}`}
        >
          {row.displayName}
        </Link>
        <span className="text-xs text-muted-foreground">{row.modelId}</span>
      </div>
    ),
    filter: {
      operators: [
        FilterOperator.Equal,
        FilterOperator.NotEqual,
        FilterOperator.Contains,
        FilterOperator.NotContains,
      ],
    },
  }),
  text('logicalKey', '调用名', {
    sortable: true,
    cell: (row) => <code className="text-xs">{row.logicalKey}</code>,
    filter: {
      operators: [
        FilterOperator.Equal,
        FilterOperator.NotEqual,
        FilterOperator.Contains,
        FilterOperator.NotContains,
      ],
    },
  }),
  {
    id: 'capabilities',
    header: '能力',
    width: 200,
    sortable: false,
    cell: (row) => capabilityBadges(row.capabilities),
  },
  {
    id: 'pricing',
    header: '当前价 (in/out)',
    width: 140,
    sortable: false,
    cell: (row) =>
      row.currentPricing
        ? `$${row.currentPricing.input} / $${row.currentPricing.output}`
        : '未计价',
  },
  status('enabled', '状态', ENABLED_OPTIONS, {
    sortable: true,
    accessor: (row) => (row.enabled ? 'enabled' : 'disabled'),
    width: 96,
    resizable: false,
    filter: {
      operators: [FilterOperator.Equal, FilterOperator.NotEqual],
      multiple: true,
    },
  }),
]);

/** 服务商下的模型面板：scope 隔离查询 + 注册、目录导入、启停与删除保护。 */
export function ModelsPanel({
  identityKey,
  providerId,
  createOpen = false,
  importOpen = false,
}: {
  identityKey: string;
  providerId: string;
  createOpen?: boolean;
  importOpen?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const removeModel = useRemoveModel();
  const setEnabled = useSetModelEnabled();
  const [createDismissed, setCreateDismissed] = useState(false);
  const [importDismissed, setImportDismissed] = useState(false);
  const [removing, setRemoving] = useState<ModelRow | null>(null);
  const creating = createOpen && !createDismissed;
  const importing = importOpen && !importDismissed;

  useEffect(() => {
    if (!createOpen) setCreateDismissed(false);
  }, [createOpen]);

  useEffect(() => {
    if (!importOpen) setImportDismissed(false);
  }, [importOpen]);

  function closeCreate(): void {
    setCreateDismissed(true);
    router.replace(pathname);
  }

  function closeImport(): void {
    setImportDismissed(true);
    router.replace(pathname);
  }

  const toggleEnabled = useCallback(
    async (row: ModelRow, enabled: boolean): Promise<void> => {
      await setEnabled.mutateAsync({ id: row.id, enabled });
      toast.success(enabled ? '模型已启用' : '模型已停用');
    },
    [setEnabled],
  );

  const rowActions = useMemo<RowAction<ModelRow>[]>(
    () => [
      {
        label: '停用',
        when: (row) => row.enabled,
        onRun: (row) => toggleEnabled(row, false),
      },
      {
        label: '启用',
        when: (row) => !row.enabled,
        onRun: (row) => toggleEnabled(row, true),
      },
      {
        label: '删除',
        danger: true,
        confirm: {
          title: '删除模型',
          description: '有价格版本或计量记录时将被拒绝（409）；可改用停用。',
          confirmLabel: '确认删除',
        },
        onRun: async (row) => {
          await removeModel.mutateAsync(row.id);
          toast.success('模型已删除');
        },
      },
    ],
    [toggleEnabled, removeModel],
  );

  return (
    <>
      <TableView
        id="mp-models"
        identityKey={identityKey}
        scope={{ providerId }}
        query={createTableQuery({ request: queryModels })}
        columns={modelColumns}
        rowKey={(row) => row.id}
        title="全部模型"
        toolbar={{
          searchable: { placeholder: '搜索模型名/调用名…', debounceMs: 300 },
          filterable: true,
          sortable: { maxRules: 3 },
          columnSettings: true,
          actions: [
            {
              label: '注册模型',
              onRun: () => router.push(`${pathname}?create=1`),
            },
            {
              label: '从目录导入',
              onRun: () => router.push(`${pathname}?import=1`),
            },
          ],
        }}
        actions={rowActions}
        defaultQuery={{
          pageSize: 20,
          sort: [{ field: 'createdAt', direction: SortDirection.Asc }],
        }}
        empty={{
          icon: BoxIcon,
          title: '尚未注册模型',
          description: '可手动注册，或从模型目录导入基线。',
          action: {
            label: '注册模型',
            onRun: () => router.push(`${pathname}?create=1`),
          },
        }}
      />

      <CreateModelDialog
        open={creating}
        providerId={providerId}
        onClose={closeCreate}
      />

      <ImportModelDialog
        open={importing}
        providerId={providerId}
        onClose={closeImport}
      />

      {!!(removing !== null) && (
        <Dialog open onOpenChange={(open) => !open && setRemoving(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>删除模型</DialogTitle>
              <DialogDescription>
                有价格版本或计量记录时将被拒绝（409）；可改用停用。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRemoving(null)}>
                取消
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  const remove = rowActions.find(
                    (item) => item.label === '删除',
                  );
                  if (remove) {
                    setRemoving(null);
                    void remove.onRun(removing);
                  }
                }}
                disabled={removeModel.isPending}
              >
                {removeModel.isPending ? '删除中…' : '确认删除'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
