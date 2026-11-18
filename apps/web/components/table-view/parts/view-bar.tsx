'use client';

import {
  ChevronDownIcon,
  Columns3Icon,
  ListFilterIcon,
  LoaderCircleIcon,
  MoreHorizontalIcon,
  SearchIcon,
  XIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { SelectionReason } from '../types';

/** 视图/批量动作的展示信息，业务执行由控制器统一管理。 */
export type ToolbarActionItem = {
  /** 动作项的稳定标识；未提供时沿用调用方约定。 */
  key?: string;
  /** 展示给用户的动作或选项名称。 */
  label: string;
  /** 是否以危险操作样式提示用户。 */
  danger?: boolean;
  /** 当前是否禁止触发该动作。 */
  disabled?: boolean;
  /** 用户选择该入口时执行的回调。 */
  onSelect: () => void;
};

/** 原地展开搜索：IME 安全、防抖，失焦保留有效条件，清除和 Esc 清空后收起。 */
function SearchInput({
  value,
  placeholder,
  debounceMs,
  onCommit,
  onCollapse,
  onClear,
}: {
  value: string;
  placeholder?: string;
  debounceMs: number;
  onCommit: (value: string) => void;
  onCollapse: () => void;
  onClear: () => void;
}) {
  const [text, setText] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const composing = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const latest = useRef(onCommit);
  latest.current = onCommit;
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => {
    input.current?.focus();
    input.current?.setSelectionRange(value.length, value.length);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value.length]);
  const schedule = (next: string) => {
    cancel();
    timer.current = setTimeout(() => {
      latest.current(next);
      timer.current = null;
    }, debounceMs);
  };
  const clear = () => {
    cancel();
    setText('');
    onClear();
    onCollapse();
  };
  return (
    <fieldset
      className={cn(
        'm-0 flex min-w-0 flex-1',
        'items-center gap-1 border-0 p-0',
      )}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget)) return;
        cancel();
        if (!composing.current) latest.current(text);
        onCollapse();
      }}
    >
      <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
      <input
        ref={input}
        aria-label="搜索表格"
        value={text}
        placeholder={placeholder ?? '输入并搜索…'}
        className={cn(
          'h-8 w-full min-w-0 bg-transparent',
          'text-[length:var(--text-meta)] outline-none sm:w-48',
        )}
        onChange={(event) => {
          setText(event.target.value);
          if (!composing.current) schedule(event.target.value);
        }}
        onCompositionStart={() => {
          composing.current = true;
          cancel();
        }}
        onCompositionEnd={(event) => {
          composing.current = false;
          schedule(event.currentTarget.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !composing.current) {
            event.stopPropagation();
            clear();
          }
        }}
      />
      {!!text && (
        <Button
          variant="ghost"
          size="icon"
          className="size-6 shrink-0"
          aria-label="清除搜索"
          onMouseDown={(event) => event.preventDefault()}
          onClick={clear}
        >
          <XIcon className="size-3.5" />
        </Button>
      )}
    </fieldset>
  );
}

/** 视图栏始终单行，搜索与多选展示由最近的交互决定，两者数据独立保留。 */
export function ViewBar({
  fetching = false,
  title,
  searchable,
  searchPlaceholder,
  searchDebounceMs,
  q,
  onSearchCommit,
  onSearchClear,
  showFilterEntry,
  filterActive,
  onFilterToggle,
  sortTrigger,
  showColumnSettings,
  hasSettableColumns,
  onOpenColumnSettings,
  columnSettingsActive,
  viewActions,
  selection,
}: {
  fetching?: boolean;
  title?: string;
  searchable: boolean;
  searchPlaceholder?: string;
  searchDebounceMs: number;
  q: string;
  onSearchCommit: (q: string) => void;
  onSearchClear: () => void;
  showFilterEntry: boolean;
  filterActive: boolean;
  onFilterToggle: () => void;
  sortTrigger?: React.ReactNode;
  showColumnSettings: boolean;
  hasSettableColumns: boolean;
  onOpenColumnSettings: () => void;
  columnSettingsActive: boolean;
  viewActions: ToolbarActionItem[];
  selection: {
    active: boolean;
    count: number;
    revision?: string;
    disabled: boolean;
    actions: ToolbarActionItem[];
    onClear: (reason?: SelectionReason) => void;
  } | null;
  onExitSelection?: () => void;
}) {
  const [mode, setMode] = useState<'normal' | 'search' | 'selection'>('normal');
  const selectionVersion = `${selection?.active ? 'selected' : 'empty'}:${selection?.revision ?? selection?.count ?? 0}`;
  useEffect(() => {
    if (selectionVersion.startsWith('selected:')) setMode('selection');
    else setMode((current) => (current === 'selection' ? 'normal' : current));
  }, [selectionVersion]);
  const bulk = mode === 'selection' && selection?.active;
  const search = mode === 'search';
  const primary = viewActions[0];
  const rest = viewActions.slice(1);
  return (
    <div
      className={cn(
        'flex min-h-11 min-w-0 shrink-0',
        'flex-nowrap items-center gap-1 border-b',
        'border-border py-1.5',
      )}
      role="toolbar"
      aria-label="视图工具栏"
    >
      <div
        className={cn(
          'flex min-w-0 items-center gap-1',
          search && 'hidden sm:flex',
        )}
      >
        <span
          className={cn(
            'min-w-0 truncate whitespace-nowrap text-[length:var(--text-body)]',
            'font-medium',
          )}
        >
          {bulk ? `已选 ${selection.count} 项` : title}
        </span>
        {fetching && (
          <span role="status" aria-label="正在刷新数据">
            <LoaderCircleIcon className="size-3.5 animate-spin text-muted-foreground" />
          </span>
        )}
        {bulk && (
          <>
            {selection.actions[0] && (
              <Button
                variant="ghost"
                size="sm"
                className="hidden h-8 shrink-0 sm:inline-flex"
                disabled={selection.actions[0].disabled}
                onClick={selection.actions[0].onSelect}
              >
                {selection.actions[0].label}
              </Button>
            )}
            {selection.actions.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    aria-label="更多批量操作"
                  >
                    <MoreHorizontalIcon className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {selection.actions.map((action, index) => (
                    <DropdownMenuItem
                      key={action.key ?? action.label}
                      className={cn(
                        index === 0 && 'sm:hidden',
                        action.danger && 'text-destructive',
                      )}
                      disabled={action.disabled}
                      onClick={action.onSelect}
                    >
                      {action.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              aria-label="清除选择"
              onClick={() => selection.onClear('clear')}
            >
              <XIcon className="size-3.5" />
            </Button>
          </>
        )}
      </div>
      <div
        className={cn(
          'ml-auto flex min-w-0 items-center gap-0.5',
          search && 'flex-1',
        )}
      >
        {searchable &&
          (search ? (
            <SearchInput
              value={q}
              placeholder={searchPlaceholder}
              debounceMs={searchDebounceMs}
              onCommit={onSearchCommit}
              onClear={onSearchClear}
              onCollapse={() =>
                setMode(selection?.active ? 'selection' : 'normal')
              }
            />
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className={cn('size-8 shrink-0', !!q && 'text-primary')}
              aria-label="搜索"
              onClick={() => setMode('search')}
            >
              <SearchIcon className="size-4" />
            </Button>
          ))}
        {showFilterEntry && (
          <Button
            variant="ghost"
            size="icon"
            className={cn('size-8 shrink-0', filterActive && 'bg-tint')}
            aria-label="筛选"
            onClick={onFilterToggle}
          >
            <ListFilterIcon className="size-4" />
          </Button>
        )}
        {sortTrigger}
        {showColumnSettings && hasSettableColumns && (
          <Button
            variant="ghost"
            size="icon"
            className={cn('size-8 shrink-0', columnSettingsActive && 'bg-tint')}
            aria-label="列设置"
            onClick={onOpenColumnSettings}
          >
            <Columns3Icon className="size-4" />
          </Button>
        )}
        {primary && !bulk && (
          <div className="ml-1 flex shrink-0 items-center">
            <Button
              size="sm"
              className={cn(
                'h-8 max-w-28 truncate',
                rest.length > 0 && 'rounded-r-none',
              )}
              disabled={primary.disabled}
              onClick={primary.onSelect}
            >
              {primary.label}
            </Button>
            {rest.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    className="h-8 w-6 rounded-l-none border-l border-background/20"
                    aria-label="更多视图操作"
                  >
                    <ChevronDownIcon className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {rest.map((action) => (
                    <DropdownMenuItem
                      key={action.key ?? action.label}
                      disabled={action.disabled}
                      onClick={action.onSelect}
                    >
                      {action.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
