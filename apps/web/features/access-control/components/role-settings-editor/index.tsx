'use client';

import { LockIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePermissionPoints } from '../../api/permission-points';
import { useDeleteRole, useRole } from '../../api/roles';
import { BasicInfoForm } from './basic-info-form';
import { PermissionsForm } from './permissions-form';

/** 组合独立的基本信息与权限表单，编辑期间各表单保持独立草稿。 */
export function RoleSettingsEditor({ roleId }: { roleId: string }) {
  const role = useRole(roleId);
  const points = usePermissionPoints();
  const remove = useDeleteRole();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  if (role.isError)
    return (
      <Alert variant="destructive">
        <AlertDescription>{role.error.message}</AlertDescription>
      </Alert>
    );
  if (!role.data) {
    return (
      <div className="grid gap-5">
        <div className="h-44 animate-pulse rounded-xl border border-border bg-card" />
        <div className="h-72 animate-pulse rounded-xl border border-border bg-card" />
      </div>
    );
  }
  return (
    <div className="grid gap-5">
      {role.data.isBuiltin && (
        <div
          className={cn(
            'flex items-start gap-2 rounded-xl border border-border bg-card',
            'px-5 py-3.5 text-[length:var(--text-meta)] text-muted-foreground',
          )}
        >
          <LockIcon className="mt-0.5 size-3.5 shrink-0" />
          内置角色的基本信息与权限由代码目录维护，此处只读。
        </div>
      )}

      <section className="rounded-xl border border-border bg-card">
        <header className="grid gap-1 border-b border-border px-6 py-4">
          <h2 className="text-[length:var(--text-section)] font-medium">
            基本信息
          </h2>
          <p className="text-[length:var(--text-meta)] text-muted-foreground">
            角色名称会出现在分配角色的对话框与成员详情中。
          </p>
        </header>
        <div className="px-6 py-5">
          <BasicInfoForm key={`${roleId}-basic`} role={role.data} />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card">
        <header className="grid gap-1 border-b border-border px-6 py-4">
          <h2 className="text-[length:var(--text-section)] font-medium">
            权限
          </h2>
          <p className="text-[length:var(--text-meta)] text-muted-foreground">
            按职责授予最小权限；权限点随代码目录自动同步，无需手工新增。
          </p>
        </header>
        <div className="px-6 py-5">
          {!!points.error && (
            <Alert variant="destructive">
              <AlertDescription>{points.error.message}</AlertDescription>
            </Alert>
          )}
          {!!points.data && (
            <PermissionsForm
              key={`${roleId}-permissions`}
              role={role.data}
              points={points.data}
            />
          )}
        </div>
      </section>

      {!role.data.isBuiltin && (
        <section className="rounded-xl border border-destructive/30 bg-card">
          <header className="grid gap-1 border-b border-border px-6 py-4">
            <h2 className="text-[length:var(--text-section)] font-medium text-destructive">
              删除角色
            </h2>
            <p className="text-[length:var(--text-meta)] text-muted-foreground">
              删除后，绑定该角色的成员会立即失去对应权限。内置角色不可删除。
            </p>
          </header>
          <div className="grid gap-3 px-6 py-5">
            {!!remove.error && (
              <Alert variant="destructive">
                <AlertDescription>{remove.error.message}</AlertDescription>
              </Alert>
            )}
            <div className="flex justify-start">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirm(true)}
              >
                删除角色
              </Button>
            </div>
          </div>
        </section>
      )}

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="删除此角色"
        description="将解绑全部绑定的成员，不影响账号本身。"
        danger
        confirmLabel="删除"
        onConfirm={async () => {
          try {
            await remove.mutateAsync(roleId);
            router.push('/admin/roles');
          } catch {
            /* mutation 错误由上方 Alert 展示。 */
            return;
          }
        }}
      />
    </div>
  );
}
