'use client';

import { ChevronRightIcon } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { TableViewColumn } from '../types';

const CARD_META_COLUMNS = 2;

/**
 * 窄屏行卡片渲染：primary 列做卡片标题（不随列重排变化），
 * 其余至多 2 列做字段行；勾选与操作随卡展示；标题区为可聚焦按钮承载
 * onRowClick（Enter/Space 原生支持）。
 */
export function TableCards<T>({
  columns,
  rows,
  rowKey,
  selectedIds,
  actions,
  disabled,
  onRowClick,
  onToggleRow,
}: {
  columns: TableViewColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  selectedIds: readonly string[];
  actions?: {
    disabled: boolean;
    render: (row: T) => React.ReactNode;
  };
  disabled?: boolean;
  onRowClick?: (row: T) => void;
  onToggleRow?: (id: string) => void;
}) {
  return (
    <div className="grid min-h-0 gap-2 overflow-y-auto py-2">
      {rows.map((row) => {
        const id = rowKey(row);
        const selected = selectedIds.includes(id);
        const primary = columns.find((column) => column.primary) ?? columns[0];
        const metaColumns = columns
          .filter((column) => column !== primary)
          .slice(0, CARD_META_COLUMNS);
        return (
          <div
            key={id}
            data-selected={selected || undefined}
            className={cn([
              'relative grid gap-1.5 rounded-lg border border-border px-3 py-2.5',
              'transition-colors hover:bg-muted/60',
              selected && 'border-primary bg-tint',
            ])}
          >
            <div className="flex items-center gap-2">
              {!!onToggleRow && (
                <Checkbox
                  aria-label={`选择行 ${id}`}
                  checked={selected}
                  disabled={disabled}
                  onCheckedChange={() => onToggleRow(id)}
                />
              )}
              <div className="min-w-0 flex-1 text-left text-[length:var(--text-body)] font-medium">
                {primary.cell
                  ? primary.cell(row)
                  : String((row as Record<string, unknown>)[primary.id] ?? '')}
              </div>
              {!!onRowClick && (
                <button
                  type="button"
                  disabled={disabled}
                  aria-label="查看行详情"
                  onClick={() => onRowClick(row)}
                >
                  <ChevronRightIcon className="size-4" />
                </button>
              )}
              {!!actions && <div>{actions.render(row)}</div>}
            </div>
            <dl className="grid gap-0.5">
              {metaColumns.map((column) => (
                <div
                  key={column.id}
                  className="grid grid-cols-[92px_1fr] gap-2"
                >
                  <dt className="text-[length:var(--text-meta)] text-muted-foreground">
                    {column.header}
                  </dt>
                  <dd className="min-w-0 text-[length:var(--text-meta)]">
                    {column.cell
                      ? column.cell(row)
                      : String(
                          (row as Record<string, unknown>)[column.id] ?? '',
                        )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        );
      })}
    </div>
  );
}
