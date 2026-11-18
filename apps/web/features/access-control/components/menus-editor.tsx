'use client';

import { ICONS, updateNavigationOverrideSchema } from '@cip/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { FieldLabel } from '@/components/field-label';
import { NavIcon } from '@/components/nav-icon';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useNavigationNodes, useUpdateNavigationNode } from '../api/navigation';
import {
  MenuNodeRow,
  type MenuNodeTreeItem,
  type MenuNodeView,
} from './menu-node-row';

/** 图标选择器的「跟随默认」哨兵值（Radix Select 不接受空串作为 item value）。 */
const DEFAULT_ICON = '__default__';

/** 导航覆盖表单 schema：沿用 shared DTO 字段，空串归 null 即恢复目录默认。 */
const overrideFormSchema = z.object({
  title: z.preprocess((value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }, updateNavigationOverrideSchema.shape.title),
  icon: z.preprocess((value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.length === 0 || value === DEFAULT_ICON ? null : trimmed;
  }, updateNavigationOverrideSchema.shape.icon),
  sort: z.preprocess((value) => {
    if (typeof value !== 'string') return value;
    return value.trim().length === 0 ? null : Number(value);
  }, updateNavigationOverrideSchema.shape.sort),
  visible: z.boolean(),
});

/** 平铺节点按 parentCode 组树（服务端固定为目录序）。 */
function buildTree(nodes: MenuNodeView[]): MenuNodeTreeItem[] {
  const byParent = new Map<string, MenuNodeView[]>();
  for (const node of nodes) {
    const key = node.parentCode ?? '';
    const bucket = byParent.get(key);
    if (bucket) bucket.push(node);
    else byParent.set(key, [node]);
  }
  const build = (parentCode: string | null): MenuNodeTreeItem[] =>
    (byParent.get(parentCode ?? '') ?? []).map((node) => ({
      node,
      children: build(node.code),
    }));
  return build(null);
}

function iconLabel(key: string): string {
  return ICONS.find((icon) => icon.key === key)?.name ?? key;
}

/** 菜单管理：左树（层级只读）+ 右面板（覆盖编辑，结构由代码目录决定）。 */
export function MenusEditor() {
  const nodes = useNavigationNodes();
  const update = useUpdateNavigationNode();
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const form = useForm<
    z.input<typeof overrideFormSchema>,
    unknown,
    z.output<typeof overrideFormSchema>
  >({
    resolver: zodResolver(overrideFormSchema),
    defaultValues: { title: '', icon: '', sort: '0', visible: true },
  });

  const tree = useMemo<MenuNodeTreeItem[]>(
    () => buildTree((nodes.data ?? []) as MenuNodeView[]),
    [nodes.data],
  );

  const selected = useMemo(
    () => nodes.data?.find((node) => node.code === selectedCode) ?? null,
    [nodes.data, selectedCode],
  );

  // 首次加载自动选中首个节点，右面板不停留在空态。
  useEffect(() => {
    if (selectedCode !== null) return;
    const first = nodes.data?.[0];
    if (!first) return;
    setSelectedCode(first.code);
    form.reset({
      title: first.title ?? '',
      icon: first.icon ?? '',
      sort: String(first.sort ?? first.defaultSort ?? 0),
      visible: first.visible,
    });
  }, [nodes.data, selectedCode, form]);

  function selectNode(code: string): void {
    const node = nodes.data?.find((item) => item.code === code);
    setSelectedCode(code);
    if (node) {
      // 选中切换即按该节点回填，reset 会覆盖未提交的编辑。
      form.reset({
        title: node.title ?? '',
        icon: node.icon ?? '',
        sort: String(node.sort ?? node.defaultSort ?? 0),
        visible: node.visible,
      });
    }
  }

  async function submitOverride(
    values: z.output<typeof overrideFormSchema>,
  ): Promise<void> {
    if (!selected) return;
    try {
      await update.mutateAsync({
        code: selected.code,
        title: values.title,
        icon: values.icon,
        sort: values.sort,
        visible: values.visible,
      });
      toast.success('已保存，用户下次刷新生效');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : '导航更新失败');
    }
  }

  async function resetOverride(): Promise<void> {
    if (!selected) return;
    const node = nodes.data?.find((item) => item.code === selected.code);
    if (!node) return;
    try {
      await update.mutateAsync({
        code: node.code,
        title: null,
        icon: null,
        sort: null,
        visible: node.visible,
      });
      form.reset({
        title: '',
        icon: '',
        sort: String(node.defaultSort ?? 0),
        visible: node.visible,
      });
      toast.success('已恢复默认，用户下次刷新生效');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : '恢复默认失败');
    }
  }

  async function toggleVisible(node: MenuNodeView): Promise<void> {
    try {
      await update.mutateAsync({
        code: node.code,
        title: node.title,
        icon: node.icon,
        sort: node.sort,
        visible: !node.visible,
      });
      toast.success(
        node.visible ? '已隐藏，下次刷新生效' : '已显示，下次刷新生效',
      );
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : '更新失败');
    }
  }

  const formErrors = form.formState.errors;

  return (
    <div className="grid gap-4">
      <p className="text-[length:var(--text-meta)] text-muted-foreground">
        路径与层级由代码目录决定，此处只调整展示文案、图标、排序与显隐。
      </p>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {nodes.isPending ? (
            <div className="grid gap-2 p-3">
              {['a', 'b', 'c', 'd', 'e'].map((id) => (
                <div
                  key={id}
                  className="h-9 animate-pulse rounded-md bg-muted"
                />
              ))}
            </div>
          ) : (
            <div role="tree" className="grid py-1">
              {tree.map((item) => (
                <MenuNodeRow
                  key={item.node.code}
                  item={item}
                  depth={0}
                  selectedCode={selectedCode}
                  onSelect={selectNode}
                  onToggle={(node) => void toggleVisible(node)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {selected ? (
            <div className="grid">
              <div className="flex items-center gap-3 border-b border-border px-5 py-4">
                <span className="inline-grid size-9 shrink-0 place-items-center rounded-lg bg-tint text-primary">
                  <NavIcon name={selected.icon ?? selected.defaultIcon ?? ''} />
                </span>
                <div className="grid min-w-0 gap-0.5">
                  <span className="truncate text-[length:var(--text-body)] font-medium">
                    {selected.title ?? selected.defaultTitle}
                  </span>
                  <span className="text-[length:var(--text-meta)] text-muted-foreground">
                    路径与层级由代码目录决定，此处只调整展示
                  </span>
                </div>
              </div>
              <form
                noValidate
                onSubmit={form.handleSubmit(
                  (values) => void submitOverride(values),
                )}
                className="grid gap-4 px-5 py-4"
              >
                <Field data-invalid={!!formErrors.title || undefined}>
                  <FieldLabel htmlFor="nav-title">展示名称</FieldLabel>
                  <Input
                    id="nav-title"
                    placeholder={`留空显示默认「${selected.defaultTitle}」`}
                    autoComplete="off"
                    {...form.register('title')}
                  />
                  <FieldError errors={[formErrors.title]} />
                </Field>
                <Field data-invalid={!!formErrors.icon || undefined}>
                  <FieldLabel htmlFor="nav-icon">图标</FieldLabel>
                  <Controller
                    control={form.control}
                    name="icon"
                    render={({ field }) => (
                      <Select
                        value={
                          typeof field.value === 'string'
                            ? field.value
                            : DEFAULT_ICON
                        }
                        onValueChange={(value) =>
                          field.onChange(value === DEFAULT_ICON ? '' : value)
                        }
                      >
                        <SelectTrigger id="nav-icon" className="w-full">
                          <span className="truncate">
                            {typeof field.value === 'string' &&
                            field.value.length > 0
                              ? iconLabel(field.value)
                              : `跟随默认（${iconLabel(
                                  selected.defaultIcon ?? '',
                                )}）`}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={DEFAULT_ICON}>
                            跟随默认
                            {selected.defaultIcon
                              ? `（${iconLabel(selected.defaultIcon)}）`
                              : ''}
                          </SelectItem>
                          {ICONS.map((icon) => (
                            <SelectItem key={icon.key} value={icon.key}>
                              {icon.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldError errors={[formErrors.icon]} />
                </Field>
                <Field data-invalid={!!formErrors.sort || undefined}>
                  <FieldLabel htmlFor="nav-sort">排序值</FieldLabel>
                  <Input
                    id="nav-sort"
                    type="number"
                    {...form.register('sort')}
                  />
                  <FieldDescription>同级内升序排列</FieldDescription>
                  <FieldError errors={[formErrors.sort]} />
                </Field>
                <div className="flex items-center justify-between gap-3">
                  <Label
                    htmlFor="nav-visible"
                    className="text-[length:var(--text-body)]"
                  >
                    在导航中显示
                  </Label>
                  <Controller
                    control={form.control}
                    name="visible"
                    render={({ field }) => (
                      <Switch
                        id="nav-visible"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                </div>
                {!!formErrors.root && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      {formErrors.root.message}
                    </AlertDescription>
                  </Alert>
                )}
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void resetOverride()}
                  >
                    恢复默认
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={form.formState.isSubmitting}
                  >
                    {form.formState.isSubmitting ? '保存中…' : '保存'}
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            <div className="grid place-items-center px-6 py-20 text-center">
              <p className="text-[length:var(--text-body)]">
                选择左侧节点进行展示定制
              </p>
              <p className="mt-1 text-[length:var(--text-meta)] text-muted-foreground">
                显隐开关可直接在清单中切换
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
