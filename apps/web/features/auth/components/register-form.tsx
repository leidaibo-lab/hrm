'use client';

import { registerSchema } from '@cip/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { FieldLabel } from '@/components/field-label';
import { Logo } from '@/components/logo';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useRegister } from '../api/auth-mutations';
import { PasswordField } from './password-field';

/** 本地注册表单：成功即登录，落空权限待管理员分配。 */
export function RegisterForm() {
  const router = useRouter();
  const register = useRegister();
  const form = useForm<z.input<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: '', name: '', email: '', password: '' },
  });

  return (
    <div className="w-full max-w-[344px]">
      <div className="hidden lg:flex">
        <Logo size={32} />
      </div>
      <h1 className="mt-0 text-[length:var(--text-title)] font-semibold lg:mt-5">
        注册
      </h1>
      <p className="mt-1.5 text-[length:var(--text-body)] text-muted-foreground">
        注册后需管理员分配角色方可使用业务功能
      </p>
      <form
        noValidate
        onSubmit={form.handleSubmit(async (input) => {
          try {
            await register.mutateAsync(input);
            router.push('/');
            router.refresh();
          } catch (cause) {
            form.setError('root', {
              message: cause instanceof Error ? cause.message : '注册失败',
            });
          }
        })}
        className="mt-6 grid gap-4"
      >
        <Field
          className="gap-1.5"
          data-invalid={!!form.formState.errors.username || undefined}
        >
          <FieldLabel
            required
            htmlFor="username"
            className="text-[length:var(--text-meta)]"
          >
            用户名
          </FieldLabel>
          <Input
            id="username"
            autoComplete="username"
            {...form.register('username')}
          />
          <FieldError errors={[form.formState.errors.username]} />
        </Field>
        <Field
          className="gap-1.5"
          data-invalid={!!form.formState.errors.name || undefined}
        >
          <FieldLabel
            required
            htmlFor="name"
            className="text-[length:var(--text-meta)]"
          >
            显示名
          </FieldLabel>
          <Input id="name" autoComplete="name" {...form.register('name')} />
          <FieldError errors={[form.formState.errors.name]} />
        </Field>
        <Field
          className="gap-1.5"
          data-invalid={!!form.formState.errors.email || undefined}
        >
          <FieldLabel
            required
            htmlFor="email"
            className="text-[length:var(--text-meta)]"
          >
            邮箱
          </FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            {...form.register('email')}
          />
          <FieldError errors={[form.formState.errors.email]} />
        </Field>
        <Field
          className="gap-1.5"
          data-invalid={!!form.formState.errors.password || undefined}
        >
          <FieldLabel
            required
            htmlFor="password"
            className="text-[length:var(--text-meta)]"
          >
            密码
          </FieldLabel>
          <PasswordField
            id="password"
            autoComplete="new-password"
            {...form.register('password')}
          />
          <FieldDescription>8–72 位</FieldDescription>
          <FieldError errors={[form.formState.errors.password]} />
        </Field>
        {form.formState.errors.root && (
          <Alert variant="destructive" className="border-destructive/30">
            <AlertDescription>
              {form.formState.errors.root.message}
            </AlertDescription>
          </Alert>
        )}
        <Button
          type="submit"
          size="lg"
          className="mt-1 w-full"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? '注册中…' : '注册'}
        </Button>
      </form>
      <p className="mt-4 text-center text-[length:var(--text-body)] text-muted-foreground">
        已有账号？
        <Link
          href="/login"
          className="ml-1 text-foreground underline underline-offset-4 transition-control hover:opacity-80"
        >
          去登录
        </Link>
      </p>
    </div>
  );
}
