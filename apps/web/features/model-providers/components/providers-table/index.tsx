'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
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
import { cn } from '@/lib/utils';
import type { ProviderRow } from '../../api/providers';
import {
  queryProviders,
  useCreateProvider,
  useRemoveProvider,
  useSetProviderEnabled,
  useTestProvider,
  useUpdateProvider,
} from '../../api/providers';
import { useProvidersExport } from '../../hooks/use-providers-export';
import {
  ProviderFormDialog,
  type ProviderFormInput,
} from './provider-form-dialog';

const STATUS_OPTIONS = {
  enabled: option.success('启用'),
  disabled: option.neutral('停用'),
};

/** 列工厂：name/slug/baseUrl 文本筛选、status 投影枚举筛选、createdAt 日期。 */
const providerColumns = createColumns<ProviderRow>(
  ({ primary, number, status, date, text }) => [
    primary('name', '供应商', {
      sortable: true,
      width: 300,
      minWidth: 220,
      meta: (row) => row.baseUrl,
      cell: (row) => (
        <div className="grid gap-0.5">
          <Link
            className="w-fit font-medium hover:underline"
            href={`/admin/ai/providers/${row.id}/models`}
          >
            {row.name}
          </Link>
          <span
            className={cn(
              'max-w-[340px] truncate font-mono text-[length:var(--text-meta)]',
              'text-muted-foreground',
            )}
          >
            {row.baseUrl}
          </span>
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
    text('slug', '标识', {
      sortable: true,
      filter: {
        operators: [
          FilterOperator.Equal,
          FilterOperator.NotEqual,
          FilterOperator.Contains,
          FilterOperator.NotContains,
        ],
      },
    }),
    number('modelCount', '模型数', {
      width: 90,
    }),
    {
      id: 'limits',
      header: '限流',
      width: 180,
      sortable: false,
      cell: (row) => (
        <span className="text-[length:var(--text-meta)] text-muted-foreground">
          <span className="tabular-nums">{row.rateLimitPerMinute ?? '∞'}</span>{' '}
          RPM · 并发{' '}
          <span className="tabular-nums">{row.maxConcurrent ?? '∞'}</span>
        </span>
      ),
    },
    status('status', '状态', STATUS_OPTIONS, {
      sortable: true,
      accessor: (row) => (row.enabled ? 'enabled' : 'disabled'),
      width: 100,
      resizable: false,
      filter: {
        operators: [FilterOperator.Equal, FilterOperator.NotEqual],
        multiple: true,
      },
    }),
    date('createdAt', '创建时间', {
      sortable: true,
      width: 130,
      resizable: false,
      filter: {
        operators: [FilterOperator.Before, FilterOperator.NotBefore],
        granularity: 'day',
      },
    }),
  ],
);

/**
 * 供应商管理表格：搜索/筛选/排序/分页 + 创建/编辑（凭据轮换）、启停、
 * 连通性测试、删除与模型页入口。新建动作上提页头，经 URL `?create=1` 受控开窗。
 */
export function ProvidersTable({
  identityKey,
  createOpen = false,
}: {
  identityKey: string;
  /** 页头「新建服务商」经 URL 下发的开窗态；关闭时组件 replace 回无参路径。 */
  createOpen?: boolean;
}) {
  const exportProviders = useProvidersExport();
  const router = useRouter();
  const pathname = usePathname();
  const createProvider = useCreateProvider();
  const updateProvider = useUpdateProvider();
  const setEnabled = useSetProviderEnabled();
  const removeProvider = useRemoveProvider();
  const testProviderMutation = useTestProvider();
  const [editing, setEditing] = useState<ProviderRow | null>(null);
  const [removing, setRemoving] = useState<ProviderRow | null>(null);
  // dismissed 让取消/提交即时关窗（不等 RSC 回写），URL 随 replace 收敛后复位。
  const [createDismissed, setCreateDismissed] = useState(false);
  const creating = createOpen && !createDismissed;

  useEffect(() => {
    if (!createOpen) setCreateDismissed(false);
  }, [createOpen]);

  function closeCreate(): void {
    setCreateDismissed(true);
    router.replace(pathname);
  }

  /** 启停：字段型状态子资源 PUT /:id/enabled。 */
  const toggleEnabled = useCallback(
    async (row: ProviderRow, enabled: boolean): Promise<void> => {
      await setEnabled.mutateAsync({ id: row.id, enabled });
      toast.success(enabled ? '供应商已启用' : '供应商已停用');
    },
    [setEnabled],
  );

  const rowActions: RowAction<ProviderRow>[] = [
    { label: '编辑', onRun: (row) => setEditing(row) },
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
      label: '测试连接',
      onRun: async (row) => {
        const result = await testProviderMutation.mutateAsync(row.id);
        if (!result.ok)
          throw new Error(`${row.name}：${result.error ?? '连接失败'}`);
        toast.success(
          `${row.name}：连通，发现 ${result.modelCount ?? 0} 个模型`,
        );
      },
    },
    {
      label: '删除',
      danger: true,
      confirm: {
        title: '删除供应商',
        description: '下仍有模型或计量记录时将被拒绝（409）；可改用停用。',
        confirmLabel: '确认删除',
      },
      onRun: async (row) => {
        await removeProvider.mutateAsync(row.id);
        toast.success('供应商已删除');
      },
    },
  ];

  return (
    <>
      <TableView
        id="mp-providers"
        identityKey={identityKey}
        query={createTableQuery({ request: queryProviders })}
        columns={providerColumns}
        rowKey={(row) => row.id}
        title="全部服务商"
        toolbar={{
          searchable: { placeholder: '搜索名称/标识/地址…', debounceMs: 300 },
          filterable: true,
          sortable: { maxRules: 3 },
          columnSettings: true,
          actions: [
            {
              label: '新建服务商',
              onRun: () => router.push(`${pathname}?create=1`),
            },
            { label: '导出服务商', onRun: exportProviders.run },
          ],
        }}
        actions={rowActions}
        defaultQuery={{
          pageSize: 20,
          sort: [{ field: 'createdAt', direction: SortDirection.Asc }],
        }}
        empty={{
          title: '还没有服务商',
          description: '接入首个模型服务商后，可在此管理凭据、限流与模型。',
        }}
      />

      <ProviderFormDialog
        open={creating}
        onClose={closeCreate}
        onSubmit={async (input: ProviderFormInput) => {
          await createProvider.mutateAsync(input);
          closeCreate();
          toast.success('供应商已创建');
        }}
      />

      {editing !== null && (
        <ProviderFormDialog
          open
          provider={editing}
          onClose={() => setEditing(null)}
          onSubmit={async (input: ProviderFormInput) => {
            const body = {
              name: input.name,
              baseUrl: input.baseUrl,
              ...(input.apiKey ? { apiKey: input.apiKey } : {}),
              timeoutMs: input.timeoutMs ?? null,
              rateLimitPerMinute: input.rateLimitPerMinute ?? null,
              maxConcurrent: input.maxConcurrent ?? null,
              enabled: editing.enabled,
            };
            await updateProvider.mutateAsync({ id: editing.id, body });
            setEditing(null);
            toast.success('供应商已更新');
          }}
        />
      )}

      {!!(removing !== null) && (
        <Dialog open onOpenChange={(open) => !open && setRemoving(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>删除供应商</DialogTitle>
              <DialogDescription>
                {removing?.name}{' '}
                下仍有模型或计量记录时将被拒绝（409）；可改用停用。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRemoving(null)}>
                取消
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setRemoving(null);
                  const action = rowActions.find(
                    (item) => item.label === '删除',
                  );
                  if (action) void action.onRun(removing);
                }}
                disabled={removeProvider.isPending}
              >
                {removeProvider.isPending ? '删除中…' : '确认删除'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
