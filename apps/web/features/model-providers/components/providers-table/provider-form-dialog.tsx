'use client';

import { createProviderSchema, updateProviderSchema } from '@cip/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { type Resolver, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { FieldLabel } from '@/components/field-label';
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
import type { ProviderRow } from '../../api/providers';

/** 表单提交值：创建与编辑共用；apiKey 编辑时留空表示不轮换。 */
export interface ProviderFormInput {
  /** 短标识。 */
  slug: string;
  /** 名称。 */
  name: string;
  /** 服务地址。 */
  baseUrl: string;
  /** 待保存的 API 密钥。 */
  apiKey: string;
  /** 超时时间，单位为毫秒。 */
  timeoutMs: number | null;
  /** 每分钟请求数限制。 */
  rateLimitPerMinute: number | null;
  /** 最大并发数。 */
  maxConcurrent: number | null;
}

interface ProviderFormDialogProps {
  open: boolean;
  provider?: ProviderRow | null;
  onClose: () => void;
  onSubmit: (input: ProviderFormInput) => Promise<void>;
}

/** 创建/编辑共用表单：校验规则取自 @cip/shared；编辑时 Key 留空 = 不轮换。 */
export function ProviderFormDialog({
  open,
  provider,
  onClose,
  onSubmit,
}: ProviderFormDialogProps) {
  const isEdit = provider !== null && provider !== undefined;
  type FormValues = z.input<typeof createProviderSchema>;
  const form = useForm<FormValues>({
    // 编辑态校验 update schema（无 slug、Key 可选），值形态与 create 输入一致
    resolver: zodResolver(
      isEdit ? updateProviderSchema : createProviderSchema,
    ) as unknown as Resolver<FormValues>,
    defaultValues: {
      slug: provider?.slug ?? '',
      name: provider?.name ?? '',
      baseUrl: provider?.baseUrl ?? '',
      apiKey: '',
      timeoutMs: provider?.timeoutMs ?? undefined,
      rateLimitPerMinute: provider?.rateLimitPerMinute ?? undefined,
      maxConcurrent: provider?.maxConcurrent ?? undefined,
    },
  });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑供应商' : '新建供应商'}</DialogTitle>
          <DialogDescription>
            OpenAI 兼容接入点；凭据加密存储，响应永不回传
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={form.handleSubmit(async (input) => {
            try {
              await onSubmit(input as never);
            } catch (cause) {
              form.setError('root', {
                message: cause instanceof Error ? cause.message : '保存失败',
              });
            }
          })}
          className="grid gap-4"
        >
          {form.formState.errors.root !== undefined && (
            <Alert variant="destructive">
              <AlertDescription>
                {form.formState.errors.root.message}
              </AlertDescription>
            </Alert>
          )}
          <Field data-invalid={!!form.formState.errors.slug || undefined}>
            <FieldLabel required htmlFor="provider-slug">
              标识 slug
            </FieldLabel>
            <Input
              id="provider-slug"
              autoComplete="off"
              disabled={isEdit}
              {...form.register('slug')}
            />
            <FieldError errors={[form.formState.errors.slug]} />
          </Field>
          <Field data-invalid={!!form.formState.errors.name || undefined}>
            <FieldLabel required htmlFor="provider-name">
              名称
            </FieldLabel>
            <Input
              id="provider-name"
              autoComplete="off"
              {...form.register('name')}
            />
            <FieldError errors={[form.formState.errors.name]} />
          </Field>
          <Field data-invalid={!!form.formState.errors.baseUrl || undefined}>
            <FieldLabel required htmlFor="provider-base-url">
              Base URL
            </FieldLabel>
            <Input
              id="provider-base-url"
              autoComplete="off"
              placeholder="https://api.example.com/v1"
              {...form.register('baseUrl')}
            />
            <FieldError errors={[form.formState.errors.baseUrl]} />
          </Field>
          <Field data-invalid={!!form.formState.errors.apiKey || undefined}>
            <FieldLabel required={!isEdit} htmlFor="provider-api-key">
              API Key{isEdit ? '（留空 = 保持不变）' : ''}
            </FieldLabel>
            <Input
              id="provider-api-key"
              type="password"
              autoComplete="new-password"
              {...form.register('apiKey', {
                setValueAs: (value) =>
                  isEdit && value === '' ? undefined : value,
              })}
            />
            <FieldError errors={[form.formState.errors.apiKey]} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field>
              <FieldLabel htmlFor="provider-timeout">超时 ms</FieldLabel>
              <Input
                id="provider-timeout"
                type="number"
                {...form.register('timeoutMs')}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="provider-qpm">每分钟上限</FieldLabel>
              <Input
                id="provider-qpm"
                type="number"
                {...form.register('rateLimitPerMinute')}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="provider-conc">并发上限</FieldLabel>
              <Input
                id="provider-conc"
                type="number"
                {...form.register('maxConcurrent')}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
