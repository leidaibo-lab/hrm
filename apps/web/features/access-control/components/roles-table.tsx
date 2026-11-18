'use client';

import { createRoleSchema } from '@cip/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldIcon } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FieldLabel } from '@/components/field-label';
import {
  createColumns,
  createTableQuery,
  FilterOperator,
  option,
  type RowAction,
  SortDirection,
  TableView,
} from '@/components/table-view';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { RoleRow } from '../api/roles';
import { queryRoles, useCreateRole, useDeleteRole } from '../api/roles';
import { useRolesExport } from '../hooks/use-roles-export';

/** 角色表单 schema：沿用 shared DTO 字段，描述空串按 null 提交。 */
const createRoleFormSchema = z.object({
  code: createRoleSchema.shape.code,
  name: createRoleSchema.shape.name,
  description: z.preprocess((value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }, createRoleSchema.shape.description),
});

const KIND_OPTIONS = {
  builtin: option.neutral('内置'),
  custom: option.success('自定义'),
};

/** 列工厂：name/code 搜索、类型投影筛选、createdAt 日期筛选。 */
const roleColumns = createColumns<RoleRow>(
  ({ primary, number, status, date, text }) => [
    primary('name', '角色', {
      sortable: true,
      width: 300,
      minWidth: 200,
      meta: (role) =>
        role.isBuiltin ? '内置角色 · 全量权限' : (role.description ?? '—'),
      filter: {
        operators: [
          FilterOperator.Equal,
          FilterOperator.NotEqual,
          FilterOperator.Contains,
          FilterOperator.NotContains,
        ],
      },
    }),
    text('code', '标识', {
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
    number('permCount', '权限点', {
      accessor: (role) => role.permissionCodes.length,
      width: 120,
      resizable: false,
      cell: (role) =>
        role.isBuiltin ? (
          <span className="text-[length:var(--text-meta)] text-muted-foreground">
            全部
          </span>
        ) : (
          <span className="tabular-nums">{role.permissionCodes.length}</span>
        ),
    }),
    status('isBuiltin', '类型', KIND_OPTIONS, {
      sortable: true,
      accessor: (role) => (role.isBuiltin ? 'builtin' : 'custom'),
      width: 110,
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

/** 角色管理表格视图：搜索/筛选/排序/分页 + 新建（编辑与授权进角色编辑页）。 */
export function RolesTable({
  identityKey,
  createOpen = false,
}: {
  identityKey: string;
  createOpen?: boolean;
}) {
  const exportRoles = useRolesExport();
  const router = useRouter();
  const pathname = usePathname();
  const createRole = useCreateRole();
  const deleteRole = useDeleteRole();
  const [deleting, setDeleting] = useState<RoleRow | null>(null);
  const [createDismissed, setCreateDismissed] = useState(false);
  const creating = createOpen && !createDismissed;
  const form = useForm<
    z.input<typeof createRoleFormSchema>,
    unknown,
    z.output<typeof createRoleFormSchema>
  >({
    resolver: zodResolver(createRoleFormSchema),
    defaultValues: { code: '', name: '', description: '' },
  });

  useEffect(() => {
    if (!createOpen) setCreateDismissed(false);
  }, [createOpen]);

  function closeCreate(): void {
    setCreateDismissed(true);
    router.replace(pathname);
  }

  const rowActions: RowAction<RoleRow>[] = [
    {
      label: '编辑',
      onRun: (role) => {
        router.push(`/admin/roles/${role.id}/edit`);
      },
    },
    {
      label: '删除',
      danger: true,
      when: (role) => !role.isBuiltin,
      onRun: (role) => {
        setDeleting(role);
      },
    },
  ];

  return (
    <>
      <TableView
        id="iam-roles"
        identityKey={identityKey}
        query={createTableQuery({ request: queryRoles })}
        columns={roleColumns}
        rowKey={(role) => role.id}
        title="全部角色"
        toolbar={{
          searchable: { placeholder: '搜索角色名/标识…', debounceMs: 300 },
          filterable: true,
          sortable: { maxRules: 3 },
          columnSettings: true,
          actions: [
            {
              label: '新建角色',
              onRun: () => router.push(`${pathname}?create=1`),
            },
            { label: '导出角色', onRun: exportRoles.run },
          ],
        }}
        actions={rowActions}
        defaultQuery={{
          pageSize: 20,
          sort: [{ field: 'createdAt', direction: SortDirection.Asc }],
        }}
        empty={{
          icon: ShieldIcon,
          title: '还没有自定义角色',
          description: '创建角色后即可在编辑页勾选权限点，并分配给成员。',
          action: {
            label: '新建角色',
            onRun: () => router.push(`${pathname}?create=1`),
          },
        }}
      />

      <Dialog
        open={creating}
        onOpenChange={(open) => {
          if (!open) closeCreate();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建角色</DialogTitle>
            <DialogDescription>创建后进入编辑页勾选权限点</DialogDescription>
          </DialogHeader>
          <form
            noValidate
            onSubmit={form.handleSubmit(async (values) => {
              try {
                await createRole.mutateAsync({
                  ...values,
                  description: values.description ?? null,
                });
                form.reset({ code: '', name: '', description: '' });
                closeCreate();
              } catch (cause) {
                form.setError('root', {
                  message: cause instanceof Error ? cause.message : '创建失败',
                });
              }
            })}
            className="grid gap-3"
          >
            <Field data-invalid={!!form.formState.errors.code || undefined}>
              <FieldLabel required htmlFor="role-code">
                标识
              </FieldLabel>
              <Input
                id="role-code"
                placeholder="project-manager"
                autoComplete="off"
                {...form.register('code')}
              />
              <FieldError errors={[form.formState.errors.code]} />
            </Field>
            <Field data-invalid={!!form.formState.errors.name || undefined}>
              <FieldLabel required htmlFor="role-name">
                名称
              </FieldLabel>
              <Input
                id="role-name"
                placeholder="项目经理"
                autoComplete="off"
                {...form.register('name')}
              />
              <FieldError errors={[form.formState.errors.name]} />
            </Field>
            <Field
              data-invalid={!!form.formState.errors.description || undefined}
            >
              <FieldLabel htmlFor="role-description">描述（可选）</FieldLabel>
              <Input
                id="role-description"
                autoComplete="off"
                {...form.register('description')}
              />
              <FieldError errors={[form.formState.errors.description]} />
            </Field>
            {form.formState.errors.root && (
              <Alert variant="destructive">
                <AlertDescription>
                  {form.formState.errors.root.message}
                </AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeCreate}
                disabled={form.formState.isSubmitting}
              >
                取消
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? '创建中…' : '创建'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`删除角色「${deleting?.name ?? ''}」`}
        description={'将解绑全部绑定的成员，不影响账号本身。'}
        confirmLabel="删除"
        cancelLabel="取消"
        danger
        onConfirm={() => {
          if (!deleting) return;
          deleteRole.mutate(deleting.id, {
            onError: (cause) => toast.error(cause.message),
          });
        }}
      />
    </>
  );
}
