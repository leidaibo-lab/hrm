'use client';

import {
  type CreateModelDto,
  createModelSchema,
  type ModelCapabilities,
  modelCapabilitiesSchema,
} from '@cip/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { FieldLabel } from '@/components/field-label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Label } from '@/components/ui/label';
import { useCreateModel } from '../../api/models';
import { CAPABILITY_LABELS, type CapabilityToggleKey } from './capability';

/** 注册模型：调用名全局唯一；能力用于请求前置校验与按能力筛选。 */
export function CreateModelDialog({
  open,
  providerId,
  onClose,
}: {
  open: boolean;
  providerId: string;
  onClose: () => void;
}) {
  const createModel = useCreateModel(providerId);
  const [caps, setCaps] = useState<Record<CapabilityToggleKey, boolean>>({
    toolCall: true,
    imageInput: false,
    audioInput: false,
    structuredOutput: false,
    reasoning: false,
    embedding: false,
    streaming: true,
  });
  const form = useForm<
    z.input<typeof createModelSchema>,
    unknown,
    CreateModelDto
  >({
    resolver: zodResolver(createModelSchema),
    defaultValues: {
      modelId: '',
      logicalKey: '',
      displayName: '',
      capabilities: modelCapabilitiesSchema.parse({
        contextWindow: 8192,
        maxOutputTokens: 4096,
        ...caps,
      }),
      defaultParams: null,
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>注册模型</DialogTitle>
          <DialogDescription>
            调用名全局唯一；能力用于请求前置校验与按能力筛选
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={form.handleSubmit(async (input) => {
            try {
              await createModel.mutateAsync(input);
              onClose();
              toast.success('模型已注册');
            } catch (cause) {
              form.setError('root', {
                message: cause instanceof Error ? cause.message : '注册失败',
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
          <Field data-invalid={!!form.formState.errors.modelId || undefined}>
            <FieldLabel required htmlFor="model-id">
              上游模型名
            </FieldLabel>
            <Input
              id="model-id"
              autoComplete="off"
              {...form.register('modelId')}
            />
            <FieldError errors={[form.formState.errors.modelId]} />
          </Field>
          <Field data-invalid={!!form.formState.errors.logicalKey || undefined}>
            <FieldLabel required htmlFor="model-key">
              调用名 logicalKey
            </FieldLabel>
            <Input
              id="model-key"
              autoComplete="off"
              {...form.register('logicalKey')}
            />
            <FieldError errors={[form.formState.errors.logicalKey]} />
          </Field>
          <Field
            data-invalid={!!form.formState.errors.displayName || undefined}
          >
            <FieldLabel required htmlFor="model-name">
              显示名
            </FieldLabel>
            <Input
              id="model-name"
              autoComplete="off"
              {...form.register('displayName')}
            />
            <FieldError errors={[form.formState.errors.displayName]} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field
              data-invalid={!!form.formState.errors.capabilities || undefined}
            >
              <FieldLabel required htmlFor="model-context">
                上下文窗口
              </FieldLabel>
              <Input
                id="model-context"
                type="number"
                {...form.register('capabilities.contextWindow', {
                  valueAsNumber: true,
                })}
              />
            </Field>
            <Field>
              <FieldLabel required htmlFor="model-output">
                最大输出
              </FieldLabel>
              <Input
                id="model-output"
                type="number"
                {...form.register('capabilities.maxOutputTokens', {
                  valueAsNumber: true,
                })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(CAPABILITY_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center gap-2 text-sm">
                <Checkbox
                  id={`cap-${key}`}
                  checked={caps[key as CapabilityToggleKey]}
                  onCheckedChange={(checked) => {
                    const next = {
                      ...caps,
                      [key]: checked === true,
                    } as Record<CapabilityToggleKey, boolean>;
                    setCaps(next);
                    form.setValue('capabilities', {
                      ...form.getValues('capabilities'),
                      ...next,
                    } as ModelCapabilities);
                  }}
                />
                <Label htmlFor={`cap-${key}`} className="font-normal">
                  {label}
                </Label>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? '注册中…' : '注册'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
