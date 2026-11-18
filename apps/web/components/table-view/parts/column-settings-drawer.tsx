'use client';

import {
  GripVerticalIcon,
  PinIcon,
  PinOffIcon,
  RotateCcwIcon,
  SearchIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { TableViewColumn } from '../types';

/** 列设置条目形态（冻结/普通区共用）。 */
export type ColumnSettingItem = {
  /** 当前列、行或视图项的稳定标识，用于交互关联。 */
  id: string;
  /** 列标题，用于表头和设置面板展示。 */
  header: string;
  /** 展示图标；省略时由所在组件决定是否使用默认图标。 */
  icon?: TableViewColumn<never>['icon'];
  /** 是否允许用户隐藏该列。 */
  hideable: boolean;
  /** 是否允许将该列冻结在滚动区域左侧。 */
  freezable: boolean;
  /** 当前冻结在滚动区域左侧的列状态。 */
  frozen: boolean;
  /** 当前是否展示该列。 */
  visible: boolean;
  /** 是否允许用户调整该列位置。 */
  reorderable: boolean;
};

/**
 * 列设置抽屉：右侧滑入 Drawer（非 Popover）；含标题、列搜索、冻结列区、
 * 普通列区、恢复默认；显示/冻结/排序即时生效并持久化，底部恢复操作固定。
 */
export function ColumnSettingsDrawer({
  open,
  onOpenChange,
  items,
  onToggleVisible,
  onToggleFreeze,
  onMove,
  onReorder,
  onReset,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ColumnSettingItem[];
  onToggleVisible: (id: string) => void;
  onToggleFreeze: (id: string) => void;
  /** 冻结区内部 / 普通区内部排序（方向 -1/1）。 */
  onMove: (id: string, direction: -1 | 1) => void;
  onReorder: (source: string, target: string) => void;
  onReset: () => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  const [keyword, setKeyword] = useState('');
  const [dragged, setDragged] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const filtered = useMemo(
    () =>
      items.filter((item) =>
        item.header.toLowerCase().includes(keyword.toLowerCase()),
      ),
    [items, keyword],
  );
  const frozen = filtered.filter((item) => item.frozen);
  const normal = filtered.filter((item) => !item.frozen);

  const renderRow = (item: ColumnSettingItem) => (
    <fieldset
      key={item.id}
      aria-label={item.header}
      className={cn(
        'm-0 flex min-w-0 items-center gap-2 rounded-md border-0 px-2 py-1.5 hover:bg-muted/60',
        target === item.id && 'border-t-2 border-primary',
      )}
      onDragOver={(event) => {
        event.preventDefault();
        if (dragged) setTarget(item.id);
      }}
      onDrop={(event) => {
        event.preventDefault();
        if (dragged) onReorder(dragged, item.id);
        setDragged(null);
        setTarget(null);
      }}
    >
      <button
        type="button"
        draggable={item.reorderable}
        disabled={!item.reorderable}
        aria-label={`拖动 ${item.header}`}
        className="cursor-grab text-muted-foreground disabled:opacity-30"
        onDragStart={(event) => {
          event.dataTransfer.setData('text/plain', item.id);
          setDragged(item.id);
        }}
        onDragEnd={() => {
          setDragged(null);
          setTarget(null);
        }}
      >
        <GripVerticalIcon className="size-3.5" />
      </button>
      <Checkbox
        checked={item.visible}
        disabled={!item.hideable && item.visible}
        aria-label={`${item.visible ? '隐藏' : '显示'} ${item.header}`}
        onCheckedChange={() => onToggleVisible(item.id)}
      />
      {!!item.icon && (
        <item.icon className="size-3.5 shrink-0 text-muted-foreground" />
      )}
      <span className="min-w-0 flex-1 truncate text-[length:var(--text-meta)]">
        {item.header}
      </span>
      <div className="flex shrink-0 items-center gap-0.5">
        {!!item.freezable && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'size-6 text-muted-foreground',
              item.frozen && 'text-foreground',
            )}
            aria-label={
              item.frozen ? `解冻 ${item.header}` : `冻结 ${item.header}`
            }
            onClick={() => onToggleFreeze(item.id)}
          >
            {item.frozen ? (
              <PinIcon className="size-3.5" />
            ) : (
              <PinOffIcon className="size-3.5" />
            )}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-muted-foreground"
          aria-label={`上移 ${item.header}`}
          disabled={!item.reorderable}
          onClick={() => onMove(item.id, -1)}
        >
          <span className="text-[length:var(--text-meta)]">↑</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-muted-foreground"
          aria-label={`下移 ${item.header}`}
          disabled={!item.reorderable}
          onClick={() => onMove(item.id, 1)}
        >
          <span className="text-[length:var(--text-meta)]">↓</span>
        </Button>
      </div>
    </fieldset>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        onCloseAutoFocus={onCloseAutoFocus}
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[360px]"
      >
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle className="text-[length:var(--text-body)]">
            列设置
          </SheetTitle>
        </SheetHeader>
        <div className="border-b border-border px-3 py-2">
          <div
            className={cn(
              'flex h-8 items-center gap-1.5',
              'rounded-md border border-input px-2',
            )}
          >
            <SearchIcon className="size-3.5 text-muted-foreground" />
            <input
              value={keyword}
              placeholder="搜索列…"
              className="w-full bg-transparent text-[length:var(--text-meta)] outline-none"
              onChange={(event) => setKeyword(event.target.value)}
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {!!(frozen.length > 0) && (
            <>
              <p
                className={cn(
                  'px-2 pb-1 pt-1 text-[length:var(--text-meta)]',
                  'font-medium text-muted-foreground',
                )}
              >
                冻结列
              </p>
              {frozen.map(renderRow)}
              {!!(normal.length > 0) && (
                <p
                  className={cn(
                    'px-2 pb-1 pt-3 text-[length:var(--text-meta)]',
                    'font-medium text-muted-foreground',
                  )}
                >
                  普通列
                </p>
              )}
            </>
          )}
          {normal.map(renderRow)}
          {!!(filtered.length === 0) && (
            <p className="px-2 py-8 text-center text-[length:var(--text-meta)] text-muted-foreground">
              没有匹配的列
            </p>
          )}
        </div>
        <div className="border-t border-border px-3 py-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full text-[length:var(--text-meta)]"
            onClick={() => {
              onReset();
              setKeyword('');
            }}
          >
            <RotateCcwIcon className="size-3.5" />
            恢复默认
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
