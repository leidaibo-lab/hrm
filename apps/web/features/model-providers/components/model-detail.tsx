'use client';

import {
  createPricingSchema,
  type ModelCapabilities,
  updateModelSchema,
} from '@cip/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useModelDetail, useUpdateModel } from '../api/models';
import { useCreatePricing, usePricings } from '../api/pricing';

/** 返回价格版本状态对应的展示样式。 */
function pricingStatusClass(status: string): string {
  if (status === 'active') return 'bg-tint text-success';
  if (status === 'pending') return 'bg-muted text-foreground';
  return 'bg-muted text-muted-foreground';
}

/** 返回价格版本状态对应的中文名称。 */
function pricingStatusLabel(status: string): string {
  if (status === 'active') return '生效中';
  if (status === 'pending') return '待生效';
  return '历史';
}

/** 模型详情：基本信息 / 能力编辑 / 价格版本（生效中·待生效·历史）。 */
export function ModelDetail({ modelId }: { modelId: string }) {
  const model = useModelDetail(modelId);
  if (model.isPending) {
    return <p className="text-sm text-muted-foreground">加载中…</p>;
  }
  if (model.isError || model.data === undefined) {
    return <p className="text-sm text-destructive">{model.error?.message}</p>;
  }
  const item = model.data;
  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <h2 className="text-lg font-semibold">{item.displayName}</h2>
        <p className="text-sm text-muted-foreground">
          {item.providerName} · {item.modelId} · 调用名{' '}
          <code className="text-xs">{item.logicalKey}</code>
        </p>
      </div>
      <Tabs defaultValue="capabilities">
        <TabsList>
          <TabsTrigger value="capabilities">能力</TabsTrigger>
          <TabsTrigger value="pricing">价格版本</TabsTrigger>
        </TabsList>
        <TabsContent value="capabilities">
          <CapabilitiesForm
            key={modelId}
            modelId={modelId}
            initial={item.capabilities}
          />
        </TabsContent>
        <TabsContent value="pricing">
          <PricingPanel modelId={modelId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CapabilitiesForm({
  modelId,
  initial,
}: {
  modelId: string;
  initial: ModelCapabilities;
}) {
  const updateModel = useUpdateModel();
  const form = useForm({
    resolver: zodResolver(updateModelSchema),
    defaultValues: { capabilities: initial },
  });
  return (
    <form
      className="grid max-w-md gap-4"
      onSubmit={form.handleSubmit(async (values) => {
        try {
          const saved = await updateModel.mutateAsync({
            id: modelId,
            body: values,
          });
          form.reset({
            capabilities: saved.capabilities,
          });
        } catch (cause) {
          form.setError('root', {
            message: cause instanceof Error ? cause.message : '更新失败',
          });
        }
      })}
    >
      <Field>
        <FieldLabel required htmlFor="cap-context">
          上下文窗口
        </FieldLabel>
        <Input
          id="cap-context"
          type="number"
          autoComplete="off"
          {...form.register('capabilities.contextWindow', {
            valueAsNumber: true,
          })}
        />
        <FieldError
          errors={[form.formState.errors.capabilities?.contextWindow]}
        />
      </Field>
      <Field>
        <FieldLabel required htmlFor="cap-output">
          最大输出
        </FieldLabel>
        <Input
          id="cap-output"
          type="number"
          autoComplete="off"
          {...form.register('capabilities.maxOutputTokens', {
            valueAsNumber: true,
          })}
        />
        <FieldError
          errors={[form.formState.errors.capabilities?.maxOutputTokens]}
        />
      </Field>
      {(
        [
          ['toolCall', '工具调用'],
          ['imageInput', '图像输入'],
          ['audioInput', '音频输入'],
          ['structuredOutput', '结构化输出'],
          ['reasoning', '推理'],
          ['embedding', '嵌入'],
          ['streaming', '流式'],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...form.register(`capabilities.${key}`)} />
          {label}
        </label>
      ))}
      {!!form.formState.errors.root && (
        <Alert variant="destructive">
          <AlertDescription>
            {form.formState.errors.root.message}
          </AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? '保存中…' : '保存能力'}
      </Button>
    </form>
  );
}

function PricingPanel({ modelId }: { modelId: string }) {
  const pricings = usePricings(modelId);
  const [adding, setAdding] = useState(false);
  return (
    <div className="grid gap-3">
      <div className="flex justify-end">
        <Button onClick={() => setAdding(true)}>新增价格版本</Button>
      </div>
      {pricings.isPending && (
        <p className="text-sm text-muted-foreground">加载中…</p>
      )}
      {pricings.data !== undefined && (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">生效时间</th>
                <th className="px-3 py-2">输入</th>
                <th className="px-3 py-2">输出</th>
                <th className="px-3 py-2">缓存读</th>
                <th className="px-3 py-2">缓存写</th>
                <th className="px-3 py-2">推理</th>
                <th className="px-3 py-2">状态</th>
              </tr>
            </thead>
            <tbody>
              {pricings.data.map((version) => (
                <tr key={version.id} className="border-t">
                  <td className="px-3 py-2 text-xs">
                    {new Date(version.effectiveFrom).toLocaleString('zh-CN')}
                  </td>
                  <td className="px-3 py-2 tabular-nums">${version.input}</td>
                  <td className="px-3 py-2 tabular-nums">${version.output}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {version.cacheRead ?? '—'}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {version.cacheWrite ?? '—'}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {version.reasoning ?? '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${pricingStatusClass(version.status)}`}
                    >
                      {pricingStatusLabel(version.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pricings.data !== undefined && pricings.data.length === 0 && (
        <p className="text-sm text-muted-foreground">
          尚未配置价格；调用照常计量但成本为空
        </p>
      )}
      <AddPricingDialog
        open={adding}
        modelId={modelId}
        onClose={() => setAdding(false)}
      />
    </div>
  );
}

function AddPricingDialog({
  open,
  modelId,
  onClose,
}: {
  open: boolean;
  modelId: string;
  onClose: () => void;
}) {
  const createPricing = useCreatePricing(modelId);
  const form = useForm({
    resolver: zodResolver(createPricingSchema),
    defaultValues: {
      currency: 'USD',
      input: 0,
      output: 0,
      cacheRead: undefined,
      cacheWrite: undefined,
      reasoning: undefined,
      effectiveFrom: `${new Date().toISOString().slice(0, 19)}Z`,
    },
  });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新增价格版本</DialogTitle>
          <DialogDescription>
            USD / 每百万 token；一版一行，调价不覆盖历史
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={form.handleSubmit(async (input) => {
            try {
              await createPricing.mutateAsync({
                currency: input.currency,
                input: input.input,
                output: input.output,
                cacheRead: input.cacheRead ?? null,
                cacheWrite: input.cacheWrite ?? null,
                reasoning: input.reasoning ?? null,
                effectiveFrom: new Date(input.effectiveFrom).toISOString(),
              });
              onClose();
              toast.success('价格版本已创建');
            } catch (cause) {
              form.setError('root', {
                message: cause instanceof Error ? cause.message : '创建失败',
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
          <div className="grid grid-cols-3 gap-3">
            <Field data-invalid={!!form.formState.errors.input || undefined}>
              <FieldLabel required htmlFor="pricing-input">
                输入 $
              </FieldLabel>
              <Input
                id="pricing-input"
                type="number"
                step="any"
                {...form.register('input', { valueAsNumber: true })}
              />
              <FieldError errors={[form.formState.errors.input]} />
            </Field>
            <Field data-invalid={!!form.formState.errors.output || undefined}>
              <FieldLabel required htmlFor="pricing-output">
                输出 $
              </FieldLabel>
              <Input
                id="pricing-output"
                type="number"
                step="any"
                {...form.register('output', { valueAsNumber: true })}
              />
              <FieldError errors={[form.formState.errors.output]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="pricing-currency">货币</FieldLabel>
              <Input id="pricing-currency" {...form.register('currency')} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field>
              <FieldLabel htmlFor="pricing-cache-read">缓存读 $</FieldLabel>
              <Input
                id="pricing-cache-read"
                type="number"
                step="any"
                {...form.register('cacheRead', { valueAsNumber: true })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="pricing-cache-write">缓存写 $</FieldLabel>
              <Input
                id="pricing-cache-write"
                type="number"
                step="any"
                {...form.register('cacheWrite', { valueAsNumber: true })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="pricing-reasoning">推理 $</FieldLabel>
              <Input
                id="pricing-reasoning"
                type="number"
                step="any"
                {...form.register('reasoning', { valueAsNumber: true })}
              />
            </Field>
          </div>
          <Field
            data-invalid={!!form.formState.errors.effectiveFrom || undefined}
          >
            <FieldLabel required htmlFor="pricing-effective">
              生效时间
            </FieldLabel>
            <Input
              id="pricing-effective"
              type="datetime-local"
              {...form.register('effectiveFrom')}
            />
            <FieldError errors={[form.formState.errors.effectiveFrom]} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? '创建中…' : '创建版本'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
