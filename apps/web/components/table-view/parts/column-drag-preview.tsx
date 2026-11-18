'use client';
import { cn } from '@/lib/utils';
import type { TableViewColumn } from '../types';

/** 拖拽中的只读列预览，不参与表格布局或交互。 */
export function ColumnDragPreview<T>({
  column,
  rows,
  rowKey,
  left,
  top,
}: {
  column?: TableViewColumn<T>;
  rows: T[];
  rowKey: (row: T) => string;
  left: number;
  top: number;
}) {
  if (!column) return null;
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none fixed z-30 w-44 overflow-hidden rounded-md',
        'border border-border bg-background opacity-90',
      )}
      style={{ left, top }}
    >
      <div
        className={cn(
          'h-9 truncate border-b border-border',
          'px-3 py-2 text-[length:var(--text-meta)] font-medium',
        )}
      >
        {column.header}
      </div>
      {rows.slice(0, 6).map((row) => (
        <div
          key={rowKey(row)}
          className={cn(
            'h-12 truncate border-b border-border',
            'px-3 py-3 text-[length:var(--text-meta)]',
          )}
        >
          {column.cell
            ? column.cell(row)
            : String(
                column.accessor
                  ? (column.accessor(row) ?? '—')
                  : ((row as Record<string, unknown>)[column.id] ?? '—'),
              )}
        </div>
      ))}
    </div>
  );
}
