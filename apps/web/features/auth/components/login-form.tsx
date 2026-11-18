'use client';

import { loginSchema } from '@cip/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { FieldLabel } from '@/components/field-label';
import { Logo } from '@/components/logo';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useLogin } from '../api/auth-mutations';
import { PasswordField } from './password-field';
import { SsoActions } from './sso-actions';

/** 本地账密登录表单：schema 与 api 同源（shared），RHF 提交前本地校验；第三方登录为占位。 */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useLogin();
  const form = useForm<z.input<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  return (
    <div className="w-full max-w-[344px]">
      <div className="hidden lg:flex">
        <Logo size={32} />
      </div>
      <h1 className="mt-0 text-[length:var(--text-title)] font-semibold lg:mt-5">
        登录
      </h1>
      <p className="mt-1.5 text-[length:var(--text-body)] text-muted-foreground">
        使用平台账号进入工作台
      </p>
      <form
        noValidate
        onSubmit={form.handleSubmit(async (input) => {
          try {
            await login.mutateAsync(input);
            // 回跳目标只允许站内路径，防开放重定向
            const next = searchParams.get('next') ?? '/';
            const target =
              next.startsWith('/') && !next.startsWith('//') ? next : '/';
            router.push(target);
            router.refresh();
          } catch (cause) {
            form.setError('root', {
              message: cause instanceof Error ? cause.message : '登录失败',
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
            autoComplete="current-password"
            {...form.register('password')}
          />
          <FieldDescription>忘记密码请联系平台管理员</FieldDescription>
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
          {form.formState.isSubmitting ? '登录中…' : '登录'}
        </Button>
      </form>
      <SsoActions />
      <p className="mt-4 text-center text-[length:var(--text-body)] text-muted-foreground">
        还没有账号？
        <Link
          href="/register"
          className="ml-1 text-foreground underline underline-offset-4 transition-control hover:opacity-80"
        >
          注册
        </Link>
      </p>
    </div>
  );
}
