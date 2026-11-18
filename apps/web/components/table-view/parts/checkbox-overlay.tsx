'use client';

import { useLayoutEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { HEADER_HEIGHT } from './data-table';
import { HeaderSelectCheckbox, RowSelectCheckbox } from './select-column';

/** 左侧留白里的选择覆盖层：按实际行几何定位，不占列宽并跟随纵向滚动。 */
export function CheckboxOverlay<T>({
  rows,
  rowKey,
  selectedIds,
  disabled,
  headerChecked,
  headerIndeterminate,
  onToggleAll,
  onToggleRow,
  scrollContainerRef,
}: {
  rows: T[];
  rowKey: (row: T) => string;
  selectedIds: readonly string[];
  disabled?: boolean;
  headerChecked: boolean;
  headerIndeterminate: boolean;
  onToggleAll: () => void;
  onToggleRow: (id: string) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [gutter, setGutter] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [positions, setPositions] = useState<
    Array<{ id: string; top: number; height: number }>
  >([]);
  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    if (rows.length === 0) {
      setPositions([]);
      return;
    }
    let frame = 0;
    const measure = () => {
      const top = container.getBoundingClientRect().top;
      setPositions(
        Array.from(
          container.querySelectorAll<HTMLTableRowElement>('tr[data-row-id]'),
        ).flatMap((row) => {
          const rect = row.getBoundingClientRect();
          const offset = rect.top - top;
          return [
            { id: row.dataset.rowId ?? '', top: offset, height: rect.height },
          ];
        }),
      );
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const hover = (event: Event) => {
      const target = event.target as HTMLElement;
      setHovered(
        target.closest<HTMLElement>('tr[data-row-id]')?.dataset.rowId ?? null,
      );
    };
    const leave = () => setHovered(null);
    const observer = new ResizeObserver(schedule);
    observer.observe(container);
    container.addEventListener('scroll', schedule);
    container.addEventListener('mousemove', hover);
    container.addEventListener('focusin', hover);
    container.addEventListener('mouseleave', leave);
    measure();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      container.removeEventListener('scroll', schedule);
      container.removeEventListener('mousemove', hover);
      container.removeEventListener('focusin', hover);
      container.removeEventListener('mouseleave', leave);
    };
  }, [rows, scrollContainerRef]);
  const ids = new Set(rows.map(rowKey));
  return (
    <fieldset
      className={cn(
        'm-0 border-0 p-0 absolute',
        'inset-y-0 -left-6 z-20 w-6',
        'overflow-hidden md:-left-7 md:w-7',
      )}
      aria-label="行选择"
      data-testid="checkbox-overlay"
      onMouseEnter={() => setGutter(true)}
      onMouseLeave={() => setGutter(false)}
    >
      <div
        className={cn(
          'absolute inset-x-0 top-0 z-10 flex h-9 translate-y-(--flow-header-offset) items-center justify-center opacity-0 focus-within:opacity-100 [@media(hover:none)]:opacity-100',
          (gutter || selectedIds.length > 0) && 'opacity-100',
        )}
      >
        <HeaderSelectCheckbox
          checked={headerChecked}
          indeterminate={headerIndeterminate}
          disabled={disabled || rows.length === 0}
          onToggle={onToggleAll}
        />
      </div>
      <div className="absolute inset-x-0 bottom-0 top-9 overflow-hidden">
        {positions
          .filter((position) => ids.has(position.id))
          .map((position) => (
            <div
              key={position.id}
              style={{
                top: position.top - HEADER_HEIGHT,
                height: position.height,
              }}
              className={cn(
                'absolute inset-x-0 flex items-center justify-center opacity-0 focus-within:opacity-100 [@media(hover:none)]:opacity-100',
                (gutter ||
                  hovered === position.id ||
                  selectedIds.includes(position.id)) &&
                  'opacity-100',
              )}
            >
              <RowSelectCheckbox
                id={position.id}
                checked={selectedIds.includes(position.id)}
                disabled={disabled}
                onToggle={onToggleRow}
              />
            </div>
          ))}
      </div>
    </fieldset>
  );
}
