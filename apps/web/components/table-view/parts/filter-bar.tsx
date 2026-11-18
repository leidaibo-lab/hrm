'use client';

import { PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { FilterCondition } from '../types';
import { FilterChip, SortChip } from './filter-chip';
import { FilterEditor } from './filter-editor';

export { filterableFields } from '../model/filter-fields';

import { type FilterableField, filterSummary } from '../model/filter-fields';
/** 条件栏：仅显示已生效 chip，添加与编辑均锚定真实触发器。 */
export function FilterBar({
  fields,
  filters,
  sort,
  open,
  onOpenChange,
  onChange,
  onSortClick,
  onSortClear,
  sortLabel,
  sortAnchorRef,
}: {
  fields: FilterableField[];
  filters: FilterCondition[];
  sort: Array<{ field: string; direction: string }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (filters: FilterCondition[]) => void;
  onSortClick: () => void;
  onSortClear: () => void;
  sortLabel?: string;
  sortAnchorRef?: React.Ref<HTMLButtonElement>;
}) {
  const [addingField, setAddingField] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const selected = fields.find((field) => field.id === addingField);
  const remove = (id: string) => {
    onChange(filters.filter((item) => item.field !== id));
    setEditing(null);
    setAddingField(null);
    onOpenChange(false);
  };
  const apply = (condition: FilterCondition) =>
    onChange([
      ...filters.filter((item) => item.field !== condition.field),
      condition,
    ]);
  const candidates = fields.filter(
    (field) =>
      !filters.some((filter) => filter.field === field.id) &&
      field.header.toLowerCase().includes(keyword.toLowerCase()),
  );
  return (
    <section
      className={cn(
        'flex min-h-9 shrink-0 items-center',
        'gap-1.5 overflow-x-auto py-1 [scrollbar-width:none]',
      )}
      aria-label="查询条件"
    >
      {sort.length > 0 && (
        <SortChip
          count={sort.length}
          label={sortLabel}
          anchorRef={sortAnchorRef}
          direction={sort[0]?.direction}
          onOpen={onSortClick}
          onClear={onSortClear}
        />
      )}
      {sort.length > 0 && filters.length > 0 && (
        <span className="h-4 w-px shrink-0 bg-border" />
      )}
      {filters.map((filter) => {
        const field = fields.find((item) => item.id === filter.field);
        if (!field) return null;
        return (
          <Popover
            key={filter.field}
            open={editing === filter.field}
            onOpenChange={(next) => setEditing(next ? filter.field : null)}
          >
            <PopoverTrigger asChild>
              <span className="inline-flex shrink-0">
                <FilterChip
                  label={field.header}
                  value={filterSummary(filter, field)}
                  onOpen={() => setEditing(field.id)}
                  onClear={() => remove(field.id)}
                />
              </span>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-3">
              <FilterEditor
                key={field.id}
                field={field}
                value={filter}
                onApply={apply}
                onClear={() => remove(field.id)}
              />
            </PopoverContent>
          </Popover>
        );
      })}
      {fields.length > 0 && (
        <Popover
          open={open}
          onOpenChange={(next) => {
            onOpenChange(next);
            if (!next) {
              setAddingField(null);
              setKeyword('');
            }
          }}
        >
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 text-muted-foreground"
              aria-label="添加筛选"
            >
              <PlusIcon className="size-3.5" />
              筛选
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-2">
            {selected ? (
              <FilterEditor
                key={selected.id}
                field={selected}
                value={filters.find((item) => item.field === selected.id)}
                onApply={apply}
                onClear={() => remove(selected.id)}
              />
            ) : (
              <div className="grid gap-1">
                <Input
                  autoFocus
                  placeholder="搜索筛选字段…"
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                />
                {candidates.map((field) => (
                  <Button
                    key={field.id}
                    variant="ghost"
                    className="justify-start"
                    onClick={() => setAddingField(field.id)}
                  >
                    {field.icon && <field.icon className="size-4" />}
                    {field.header}
                  </Button>
                ))}
                {candidates.length === 0 && (
                  <p className="p-3 text-[length:var(--text-meta)] text-muted-foreground">
                    没有可添加的字段
                  </p>
                )}
              </div>
            )}
          </PopoverContent>
        </Popover>
      )}
    </section>
  );
}
