'use client';

import type { LucideIcon } from 'lucide-react';
import { InboxIcon, SearchXIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * 统一空态：组件内置居中/间距/暗色/窄屏样式；空态占可视宽度，
 * 不随横向滚动偏移，保留表头和分页。
 */
export function EmptyState({
  icon: Icon = InboxIcon,
  title = '暂无数据',
  description,
  action,
  variant = 'empty',
}: {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  action?: { label: string; onSelect: () => void; disabled?: boolean };
  variant?: 'empty' | 'no-result' | 'error';
}) {
  let ResolvedIcon: LucideIcon | undefined = Icon;
  if (variant === 'no-result') ResolvedIcon = SearchXIcon;
  if (variant === 'error') ResolvedIcon = undefined;
  return (
    <div
      className={cn(
        'flex min-h-[240px] w-full flex-col',
        'items-center justify-center gap-1 px-7',
        'py-16 text-center',
      )}
    >
      {!!ResolvedIcon && (
        <ResolvedIcon
          className="mb-1 size-8 text-muted-foreground/60"
          strokeWidth={1.5}
        />
      )}
      <p className="text-[length:var(--text-body)] font-medium">{title}</p>
      {!!description && (
        <p className="max-w-[360px] text-[length:var(--text-meta)] text-muted-foreground">
          {description}
        </p>
      )}
      {!!action && (
        <Button
          size="sm"
          variant="outline"
          className="mt-3"
          disabled={action.disabled}
          onClick={action.onSelect}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}

/** 查询失败态：结构化错误文案 + retry。 */
export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      className={cn(
        'flex min-h-[240px] w-full flex-col',
        'items-center justify-center gap-2 px-7',
        'py-16 text-center',
      )}
    >
      <p className="text-[length:var(--text-body)] font-medium">数据加载失败</p>
      <p
        className={cn(
          'max-w-[480px] break-all text-[length:var(--text-meta)] text-muted-foreground',
        )}
      >
        {message}
      </p>
      <Button size="sm" variant="outline" className="mt-2" onClick={onRetry}>
        重试
      </Button>
    </div>
  );
}

/** 首次加载骨架（不是「加载中…」纯文本）。 */
export function SkeletonRows({ rows = 8 }: { rows?: number }) {
  return (
    <div className="w-full" aria-hidden="true">
      {SKELETON_KEYS.slice(0, rows).map((key) => (
        <div
          key={key}
          className="h-12 animate-pulse border-b border-border bg-muted/40"
        />
      ))}
    </div>
  );
}

/** 骨架行稳定键（静态列表，规避数组下标键）。 */
const SKELETON_KEYS = Array.from(
  { length: 20 },
  (_, index) => `skeleton-${index}`,
);
