'use client';

import { updateRoleInputSchema } from '@cip/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { FieldLabel } from '@/components/field-label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useUpdateRole } from '../../api/roles';

const FIELD_ROW =
  'gap-2 sm:grid sm:grid-cols-[96px_minmax(0,1fr)] sm:items-start sm:gap-4';
const READONLY_ROW =
  'grid gap-2 sm:grid-cols-[96px_minmax(0,1fr)] sm:items-start sm:gap-4';
const FIELD_LABEL =
  'pt-1.5 text-[length:var(--text-meta)] text-muted-foreground';

/** 基本信息独立草稿；查询刷新不会重新初始化用户输入。 */
export function BasicInfoForm({
  role,
}: {
  role: {
    id: string;
    isBuiltin: boolean;
    name: string;
    description: string | null;
  };
}) {
  const mutation = useUpdateRole();
  const form = useForm({
    resolver: zodResolver(updateRoleInputSchema),
    defaultValues: {
      name: role.name,
      description: role.description,
    },
  });

  if (role.isBuiltin) {
    return (
      <div className="grid gap-4">
        <div className={READONLY_ROW}>
          <span className={FIELD_LABEL}>名称</span>
          <span className="text-[length:var(--text-body)]">{role.name}</span>
        </div>
        <div className={READONLY_ROW}>
          <span className={FIELD_LABEL}>描述</span>
          <span className="text-[length:var(--text-meta)] text-muted-foreground">
            内置角色的描述由代码目录维护。
          </span>
        </div>
      </div>
    );
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={form.handleSubmit(async (values) => {
        try {
          const saved = await mutation.mutateAsync({
            id: role.id,
            name: values.name,
            description: values.description ?? null,
          });
          form.reset({
            name: saved.name,
            description: saved.description,
          });
        } catch (cause) {
          form.setError('root', {
            message: cause instanceof Error ? cause.message : '保存失败',
          });
        }
      })}
    >
      <Field
        className={FIELD_ROW}
        data-invalid={!!form.formState.errors.name || undefined}
      >
        <FieldLabel required htmlFor="role-name" className={FIELD_LABEL}>
          名称
        </FieldLabel>
        <div className="grid gap-1.5">
          <Input
            id="role-name"
            autoComplete="off"
            aria-required
            {...form.register('name')}
          />
          <FieldError errors={[form.formState.errors.name]} />
        </div>
      </Field>
      <Field
        className={FIELD_ROW}
        data-invalid={!!form.formState.errors.description || undefined}
      >
        <FieldLabel htmlFor="role-description" className={FIELD_LABEL}>
          描述
        </FieldLabel>
        <div className="grid gap-1.5">
          <Input
            id="role-description"
            autoComplete="off"
            {...form.register('description')}
          />
          <FieldError errors={[form.formState.errors.description]} />
        </div>
      </Field>
      {!!form.formState.errors.root && (
        <Alert variant="destructive">
          <AlertDescription>
            {form.formState.errors.root.message}
          </AlertDescription>
        </Alert>
      )}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? '保存中…' : '保存基本信息'}
        </Button>
      </div>
    </form>
  );
}
