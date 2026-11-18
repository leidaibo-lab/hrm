'use client';

import { SortDirection } from '@cip/shared';
import { GripVerticalIcon, PlusIcon, Trash2Icon, XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { SortDirection as SortDirectionType, SortRule } from '../types';

/** 可排序字段（派生：列声明 sortable）。 */
export type SortableField = {
  /** 当前列、行或视图项的稳定标识，用于交互关联。 */
  id: string;
  /** 列标题，用于表头和设置面板展示。 */
  header: string;
  /** 展示图标；省略时由所在组件决定是否使用默认图标。 */
  icon?: TableViewIcon;
  /** 值或状态分支标识，用于约束后续操作和取值。 */
  kind?: 'text' | 'number' | 'enum' | 'date';
};

type TableViewIcon = React.ComponentType<{ className?: string }>;

/** 可排序字段选择器：无排序规则时的属性选择（搜索 + 默认升序）。 */
function FieldPicker({
  fields,
  used,
  onPick,
  onDismiss,
}: {
  fields: SortableField[];
  used: Set<string>;
  onPick: (id: string) => void;
  onDismiss: () => void;
}) {
  const [keyword, setKeyword] = useState('');
  const candidates = fields.filter(
    (field) =>
      !used.has(field.id) &&
      field.header.toLowerCase().includes(keyword.toLowerCase()),
  );
  return (
    <div className="grid gap-1">
      <input
        ref={(element) => {
          // 浮层打开即聚焦搜索框（以 ref 触发替代 autofocus 属性）。
          element?.focus();
        }}
        value={keyword}
        placeholder="搜索字段…"
        className={[
          'h-8 rounded-md border border-input bg-transparent px-2',
          'text-[length:var(--text-meta)] outline-none focus:border-ring',
        ].join(' ')}
        onChange={(event) => setKeyword(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onDismiss();
        }}
      />
      <div className="grid max-h-56 gap-0.5 overflow-y-auto">
        {candidates.map((field) => (
          <button
            key={field.id}
            type="button"
            className={[
              'flex items-center gap-2 rounded-md px-2 py-1.5 text-left',
              'text-[length:var(--text-meta)] hover:bg-muted',
            ].join(' ')}
            onClick={() => onPick(field.id)}
          >
            {!!field.icon && (
              <field.icon className="size-3.5 text-muted-foreground" />
            )}
            <span className="truncate">{field.header}</span>
          </button>
        ))}
        {!!(candidates.length === 0) && (
          <p className="px-2 py-4 text-center text-[length:var(--text-meta)] text-muted-foreground">
            没有匹配的字段
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * 排序规则编辑器：拖拽把手 + 字段 + 方向 + X；
 * 添加/删除全部；重复字段禁选；达到 maxRules 禁用添加但已有规则可改删。
 */
export function SortPopover({
  fields,
  sort,
  maxRules,
  onSortChange,
  open: openProp,
  onOpenChange,
  children,
  anchorRef,
}: {
  fields: SortableField[];
  sort: SortRule[];
  maxRules: number;
  onSortChange: (sort: SortRule[]) => void;
  /** 受控开启（排序 chip 重开规则编辑器）。 */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  anchorRef?: React.RefObject<HTMLButtonElement | null>;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const [picking, setPicking] = useState(sort.length === 0);
  const [fieldEditing, setFieldEditing] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // 打开时重置面板模式（sort 内容变化不改变面板模式）；重置语义为「开合一次」。
  // biome-ignore lint/correctness/useExhaustiveDependencies: 依赖 sort 会在编辑规则时把面板重置回选择器。
  useEffect(() => {
    if (!open) setPicking(sort.length === 0);
  }, [open]);

  const headerOf = (fieldId: string) =>
    fields.find((field) => field.id === fieldId)?.header ?? fieldId;
  const used = new Set(sort.map((rule) => rule.field));

  const pick = (fieldId: string) => {
    onSortChange([...sort, { field: fieldId, direction: SortDirection.Asc }]);
    setPicking(false);
  };

  const reorder = (from: number, to: number) => {
    if (from === to) return;
    const next = [...sort];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onSortChange(next);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      {sort.length > 0 && anchorRef && (
        <PopoverAnchor
          virtualRef={{
            current: {
              getBoundingClientRect: () =>
                anchorRef.current?.getBoundingClientRect() ?? new DOMRect(),
            },
          }}
        />
      )}
      <PopoverContent align="end" className="w-80 p-2">
        {sort.length === 0 || picking ? (
          <>
            <p
              className={cn(
                'px-1 pb-1 pt-0.5 text-[length:var(--text-meta)]',
                'font-medium text-muted-foreground',
              )}
            >
              选择排序字段
            </p>
            <FieldPicker
              fields={fields}
              used={used}
              onPick={pick}
              onDismiss={() => {
                setPicking(false);
                if (sort.length === 0) setOpen(false);
              }}
            />
          </>
        ) : (
          <>
            <ul className="grid list-none gap-1" aria-label="排序规则">
              {sort.map((rule, index) => (
                <li
                  key={rule.field}
                  aria-label={`排序 ${index + 1}`}
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(event) => {
                    event.preventDefault();
                    if (dragIndex !== null && dragIndex !== index) {
                      setDropIndex(index);
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (dragIndex !== null) reorder(dragIndex, index);
                    setDragIndex(null);
                    setDropIndex(null);
                  }}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setDropIndex(null);
                  }}
                  className={cn(
                    'flex items-center gap-1 rounded-md border border-transparent px-1 py-0.5',
                    dragIndex === index && 'opacity-50',
                    dragIndex !== index &&
                      dropIndex === index &&
                      'border-t-primary',
                  )}
                >
                  <button
                    type="button"
                    aria-label={`移动 ${headerOf(rule.field)} 排序`}
                    className="cursor-grab text-muted-foreground"
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowUp' && index > 0) {
                        event.preventDefault();
                        reorder(index, index - 1);
                      }
                      if (
                        event.key === 'ArrowDown' &&
                        index < sort.length - 1
                      ) {
                        event.preventDefault();
                        reorder(index, index + 1);
                      }
                    }}
                  >
                    <GripVerticalIcon className="size-3.5" />
                  </button>
                  <Popover
                    open={fieldEditing === rule.field}
                    onOpenChange={(next) =>
                      setFieldEditing(next ? rule.field : null)
                    }
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 min-w-0 flex-1 justify-start truncate"
                      >
                        {headerOf(rule.field)}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-60 p-2" align="start">
                      <FieldPicker
                        fields={fields}
                        used={
                          new Set(
                            sort
                              .filter((item) => item.field !== rule.field)
                              .map((item) => item.field),
                          )
                        }
                        onPick={(field) => {
                          const next = [...sort];
                          next[index] = { ...rule, field };
                          onSortChange(next);
                          setFieldEditing(null);
                        }}
                        onDismiss={() => setFieldEditing(null)}
                      />
                    </PopoverContent>
                  </Popover>
                  <Select
                    value={rule.direction}
                    onValueChange={(value) => {
                      const next = [...sort];
                      next[index] = {
                        ...rule,
                        direction: value as SortDirectionType,
                      };
                      onSortChange(next);
                    }}
                  >
                    <SelectTrigger
                      size="sm"
                      className="h-7 w-[100px] shrink-0 text-[length:var(--text-meta)]"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        value={SortDirection.Asc}
                        className="text-[length:var(--text-meta)]"
                      >
                        {sortDirectionLabel(
                          fields.find((field) => field.id === rule.field)?.kind,
                          SortDirection.Asc,
                        )}
                      </SelectItem>
                      <SelectItem
                        value={SortDirection.Desc}
                        className="text-[length:var(--text-meta)]"
                      >
                        {sortDirectionLabel(
                          fields.find((field) => field.id === rule.field)?.kind,
                          SortDirection.Desc,
                        )}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 shrink-0 text-muted-foreground"
                    aria-label={`删除 ${headerOf(rule.field)} 排序`}
                    onClick={() =>
                      onSortChange(sort.filter((item) => item !== rule))
                    }
                  >
                    <XIcon className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
            <div className="mt-1 flex items-center justify-between border-t border-border pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[length:var(--text-meta)] text-muted-foreground"
                disabled={
                  sort.length >= maxRules || sort.length >= fields.length
                }
                onClick={() => setPicking(true)}
              >
                <PlusIcon className="size-3.5" />
                添加排序
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[length:var(--text-meta)] text-muted-foreground"
                disabled={sort.length === 0}
                onClick={() => onSortChange([])}
              >
                <Trash2Icon className="size-3.5" />
                删除全部
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** 日期、数值和其他字段分别使用可理解的排序方向文案。 */
function sortDirectionLabel(
  kind: SortableField['kind'],
  direction: SortDirectionType,
): string {
  if (kind === 'date')
    return direction === SortDirection.Asc ? '从旧到新' : '从新到旧';
  if (kind === 'number')
    return direction === SortDirection.Asc ? '从小到大' : '从大到小';
  return direction === SortDirection.Asc ? 'A → Z' : 'Z → A';
}
