'use client';

import { setRolePermissionsInputSchema } from '@cip/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useSetRolePermissions } from '../../api/roles';

/** 权限资源 → 人类可读分组名（权限码不进 UI）。 */
const RESOURCE_LABELS: Record<string, string> = {
  user: '用户管理',
  role: '角色管理',
  navigation: '菜单管理',
  'permission-point': '权限点',
  'model-provider': '模型服务',
  model: '模型与价格',
  usage: '用量报表',
};

/** 分组展示顺序：与导航业务域一致，未知资源排在最后。 */
const RESOURCE_ORDER = [
  'user',
  'role',
  'navigation',
  'permission-point',
  'model-provider',
  'model',
  'usage',
];

type PermissionPoint = {
  code: string;
  summary: string;
  state: string;
  resource: string;
};

/** 去掉与分组标题重复的前缀（权限摘要形如「用户管理：…」）。 */
function pointSummary(point: PermissionPoint, groupLabel: string): string {
  const prefix = `${groupLabel}：`;
  return point.summary.startsWith(prefix)
    ? point.summary.slice(prefix.length)
    : point.summary;
}

/** 权限草稿独立保存：按人类可读分组展示、全选与内置角色只读。 */
export function PermissionsForm({
  role,
  points,
}: {
  role: {
    id: string;
    permissionCodes: string[];
    isBuiltin: boolean;
  };
  points: PermissionPoint[];
}) {
  const mutation = useSetRolePermissions();
  const form = useForm({
    resolver: zodResolver(setRolePermissionsInputSchema),
    defaultValues: {
      permissionCodes: [...role.permissionCodes],
    },
  });
  const resources = [...new Set(points.map((point) => point.resource))].sort(
    (a, b) => {
      const orderA = RESOURCE_ORDER.indexOf(a);
      const orderB = RESOURCE_ORDER.indexOf(b);
      return (
        (orderA === -1 ? RESOURCE_ORDER.length : orderA) -
        (orderB === -1 ? RESOURCE_ORDER.length : orderB)
      );
    },
  );

  return (
    <form
      className="grid gap-5"
      onSubmit={form.handleSubmit(async (values) => {
        if (role.isBuiltin) return;
        try {
          const saved = await mutation.mutateAsync({
            id: role.id,
            permissionCodes: values.permissionCodes,
          });
          form.reset({
            permissionCodes: saved.permissionCodes,
          });
        } catch (cause) {
          form.setError('root', {
            message: cause instanceof Error ? cause.message : '保存失败',
          });
        }
      })}
    >
      <Controller
        control={form.control}
        name="permissionCodes"
        render={({ field }) => (
          <div className="grid gap-0">
            {resources.map((resource) => {
              const group = points.filter(
                (point) => point.resource === resource,
              );
              const selectable = group
                .filter((point) => point.state === 'active')
                .map((point) => point.code);
              const selectedCount = role.isBuiltin
                ? group.length
                : group.filter((point) => field.value.includes(point.code))
                    .length;
              const allSelected =
                selectable.length > 0 &&
                selectable.every((code) => field.value.includes(code));
              return (
                <section
                  key={resource}
                  className="grid gap-1.5 border-b border-border py-4 first:pt-0 last:border-b-0 last:pb-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-[length:var(--text-meta)] font-medium">
                        {RESOURCE_LABELS[resource] ?? resource}
                      </h3>
                      <span className="font-mono text-[length:var(--text-meta)] tabular-nums text-muted-foreground">
                        {selectedCount} / {group.length}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={role.isBuiltin || selectable.length === 0}
                      onClick={() =>
                        field.onChange(
                          allSelected
                            ? field.value.filter(
                                (code) => !selectable.includes(code),
                              )
                            : [...new Set([...field.value, ...selectable])],
                        )
                      }
                      className={cn(
                        'text-[length:var(--text-meta)] text-primary underline-offset-2 hover:underline',
                        'disabled:cursor-not-allowed disabled:opacity-40',
                      )}
                    >
                      {allSelected ? '取消全选' : '全选'}
                    </button>
                  </div>
                  <div className="grid gap-0.5">
                    {group.map((point) => (
                      <label
                        key={point.code}
                        htmlFor={`permission-${point.code}`}
                        className={cn(
                          'flex items-start gap-2.5 rounded-md px-2 py-1.5',
                          'text-[length:var(--text-body)] transition-control hover:bg-muted/60',
                        )}
                      >
                        <Checkbox
                          id={`permission-${point.code}`}
                          className="mt-0.5"
                          checked={
                            role.isBuiltin || field.value.includes(point.code)
                          }
                          disabled={
                            role.isBuiltin ||
                            (point.state !== 'active' &&
                              !field.value.includes(point.code))
                          }
                          onCheckedChange={(checked) =>
                            field.onChange(
                              checked === true
                                ? [...new Set([...field.value, point.code])]
                                : field.value.filter(
                                    (code) => code !== point.code,
                                  ),
                            )
                          }
                        />
                        <span className="min-w-0">
                          {pointSummary(
                            point,
                            RESOURCE_LABELS[resource] ?? resource,
                          )}
                          {point.state !== 'active' && (
                            <span className="ml-1 text-[length:var(--text-meta)] text-muted-foreground">
                              （已废弃）
                            </span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      />
      {!!form.formState.errors.root && (
        <Alert variant="destructive">
          <AlertDescription>
            {form.formState.errors.root.message}
          </AlertDescription>
        </Alert>
      )}
      {!role.isBuiltin && (
        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? '保存中…' : '保存权限'}
          </Button>
        </div>
      )}
    </form>
  );
}
