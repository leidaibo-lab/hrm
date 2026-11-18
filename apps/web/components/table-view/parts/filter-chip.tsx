'use client';

import {
  ArrowDownNarrowWideIcon,
  ArrowUpNarrowWideIcon,
  XIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/** 条件 chip：显示字段/操作符/值摘要；主体点击重开锚定编辑器，X 直接清除。 */
export function FilterChip({
  label,
  value,
  onOpen,
  onClear,
}: {
  label: string;
  value: string;
  onOpen: () => void;
  onClear: () => void;
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-[280px] items-center gap-1 rounded-md bg-muted px-1.5 py-0.5',
        'text-[length:var(--text-meta)]',
      )}
    >
      <button
        type="button"
        className="inline-flex min-w-0 items-center gap-1 rounded-sm hover:text-foreground"
        onClick={onOpen}
        title={`${label} ${value}`}
      >
        <span className="shrink-0 text-muted-foreground">{label}</span>
        <span className="truncate">{value}</span>
      </button>
      <button
        type="button"
        aria-label={`清除 ${label} 条件`}
        className={cn(
          'inline-grid size-4 shrink-0 place-items-center rounded-sm',
          'text-muted-foreground hover:text-foreground',
        )}
        onClick={onClear}
      >
        <XIcon className="size-3" />
      </button>
    </span>
  );
}

/** 多规则排序 chip：显示 `N 个排序`，点击重开规则编辑器，位于筛选 chip 左侧。 */
export function SortChip({
  count,
  label,
  direction,
  anchorRef,
  onOpen,
  onClear,
}: {
  count: number;
  label?: string;
  direction?: string;
  anchorRef?: React.Ref<HTMLButtonElement>;
  onOpen: () => void;
  onClear: () => void;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5',
        'text-[length:var(--text-meta)]',
      )}
    >
      <button
        ref={anchorRef}
        type="button"
        className="inline-flex items-center gap-1 rounded-sm hover:text-foreground"
        onClick={onOpen}
        title="排序规则"
      >
        {direction === 'desc' ? (
          <ArrowDownNarrowWideIcon className="size-3.5" />
        ) : (
          <ArrowUpNarrowWideIcon className="size-3.5" />
        )}
        <span>{count === 1 && label ? label : `${count} 个排序`}</span>
      </button>
      <button
        type="button"
        aria-label="清除全部排序"
        className={cn(
          'inline-grid size-4 shrink-0 place-items-center rounded-sm',
          'text-muted-foreground hover:text-foreground',
        )}
        onClick={onClear}
      >
        <XIcon className="size-3" />
      </button>
    </span>
  );
}
