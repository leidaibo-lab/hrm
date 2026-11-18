'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  usePermissionPoints,
  useUpdatePermissionSummary,
} from '../api/permission-points';

/** 权限资源 → 人类可读分组名。 */
const RESOURCE_LABELS: Record<string, string> = {
  user: '用户管理',
  role: '角色管理',
  navigation: '菜单管理',
  'permission-point': '权限点',
  'model-provider': '模型服务',
  model: '模型与价格',
  usage: '用量报表',
};

const RESOURCE_ORDER = [
  'user',
  'role',
  'navigation',
  'permission-point',
  'model-provider',
  'model',
  'usage',
];

/** 摘要形如「用户管理：…」时去掉与分组标题重复的前缀。 */
function stripGroupPrefix(summary: string, groupLabel: string): string {
  const prefix = `${groupLabel}：`;
  return summary.startsWith(prefix) ? summary.slice(prefix.length) : summary;
}

/** 权限点清单（只读目录 + 摘要覆盖编辑）：目录是唯一事实源，此处不可增删权限点。 */
export function PermissionPointsTable() {
  const points = usePermissionPoints();
  const updateSummary = useUpdatePermissionSummary();
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const groups = useMemo(() => {
    if (!points.data) return [];
    const map = new Map<string, NonNullable<typeof points.data>>();
    for (const point of points.data) {
      const list = map.get(point.resource) ?? [];
      list.push(point);
      map.set(point.resource, list);
    }
    return [...map.entries()].sort(([a], [b]) => {
      const orderA = RESOURCE_ORDER.indexOf(a);
      const orderB = RESOURCE_ORDER.indexOf(b);
      return (
        (orderA === -1 ? RESOURCE_ORDER.length : orderA) -
        (orderB === -1 ? RESOURCE_ORDER.length : orderB)
      );
    });
  }, [points.data]);

  async function submit(code: string, summary: string | null): Promise<void> {
    try {
      await updateSummary.mutateAsync({ code, summary });
      setEditingCode(null);
      toast.success('摘要已更新');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : '更新失败');
    }
  }

  if (points.isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex items-center justify-between gap-3">
          {points.error.message}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void points.refetch()}
          >
            重试
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="grid gap-5">
      <p className="text-[length:var(--text-meta)] text-muted-foreground">
        权限点由代码目录自动收集（增删随发版），此处仅可定制展示摘要；授予关系在角色编辑页维护。
      </p>
      {points.isPending ? (
        <div className="grid gap-4">
          {['a', 'b', 'c'].map((id) => (
            <div
              key={id}
              className="h-32 animate-pulse rounded-xl border border-border bg-card"
            />
          ))}
        </div>
      ) : (
        groups.map(([resource, list]) => (
          <section
            key={resource}
            className="overflow-hidden rounded-xl border border-border bg-card"
          >
            <header className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="text-[length:var(--text-meta)] font-medium">
                {RESOURCE_LABELS[resource] ?? resource}
              </h2>
              <span className="font-mono text-[length:var(--text-meta)] tabular-nums text-muted-foreground">
                {list.length} 项
              </span>
            </header>
            <div className="grid">
              {list.map((point) => {
                const deprecated = point.state === 'deprecated';
                return (
                  <div
                    key={point.code}
                    className={cn(
                      'flex items-center gap-4 border-b border-border px-5 py-3',
                      'last:border-b-0',
                      deprecated && 'opacity-60',
                    )}
                  >
                    <div className="grid min-w-0 flex-1 gap-0.5">
                      <span className="truncate text-[length:var(--text-body)] font-medium">
                        {stripGroupPrefix(
                          point.summary,
                          RESOURCE_LABELS[resource] ?? resource,
                        )}
                        {deprecated && (
                          <span className="ml-1 text-[length:var(--text-meta)] font-normal text-muted-foreground">
                            已废弃
                          </span>
                        )}
                        {point.summary !== point.defaultSummary && (
                          <span className="ml-1 text-[length:var(--text-meta)] font-normal text-primary">
                            已覆盖
                          </span>
                        )}
                      </span>
                      <span className="truncate font-mono text-[length:var(--text-meta)] text-muted-foreground">
                        {point.code}
                      </span>
                    </div>
                    {editingCode === point.code ? (
                      <form
                        className="flex shrink-0 items-center gap-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void submit(
                            point.code,
                            draft.trim().length > 0 ? draft.trim() : null,
                          );
                        }}
                      >
                        <Input
                          value={draft}
                          onChange={(event) => setDraft(event.target.value)}
                          className="h-8 w-64"
                          autoFocus
                        />
                        <Button
                          type="submit"
                          size="sm"
                          disabled={updateSummary.isPending}
                        >
                          保存
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingCode(null)}
                        >
                          取消
                        </Button>
                      </form>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => {
                          setEditingCode(point.code);
                          setDraft(point.summary);
                        }}
                      >
                        编辑摘要
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
