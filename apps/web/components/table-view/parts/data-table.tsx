'use client';

import { EllipsisIcon } from 'lucide-react';
import { useLayoutEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useColumnResize } from '../hooks/use-column-resize';
import { useFlowHeader } from '../hooks/use-flow-header';
import type {
  DragView,
  RenderColumn,
  TableViewStatus,
} from '../model/render-state';
import type { TableViewColumn } from '../types';
import { ColumnDragPreview } from './column-drag-preview';
import { TableStatusContent } from './table-status-content';

export type {
  DragView,
  RenderColumn,
  TableViewStatus,
} from '../model/render-state';

export const HEADER_HEIGHT = 36;
export const ROW_HEIGHT = 48;
const DEFAULT_COLUMN_WIDTH = 160;
const ACTIONS_COLUMN_WIDTH = 120;

/**
 * 表格主体：表头默认 sticky；横向滚动仅含表头与数据区，
 * 分页底栏是滚动区兄弟区域；冻结列组成连续左侧 sticky 区；
 * resize 在 pointer up 提交、双击恢复默认；列拖拽超阈值显示插入线并弱化源列。
 */
export function DataTable<T>({
  columns,
  actionsColumn,
  rows,
  rowKey,
  selection,
  status,
  pinActions,
  drag,
  onRowClick,
  onResizeCommit,
  onResizeReset,
  scrollContainerRef,
  overlaySlot,
  flow = false,
}: {
  columns: RenderColumn<T>[];
  actionsColumn?: {
    disabled: boolean;
    render: (row: T) => React.ReactNode;
  };
  rows: T[];
  rowKey: (row: T) => string;
  selection: {
    isRowSelected: (id: string) => boolean;
  } | null;
  /** 渲染状态：pending / error / no-result / empty / ready。 */
  status: TableViewStatus;
  pinActions: boolean;
  drag: {
    drag: DragView;
    onPointerMove: (event: React.PointerEvent) => void;
    onPointerUp: (event: React.PointerEvent) => void;
    onPointerDown: (id: string, event: React.PointerEvent) => void;
    onKeyDown: (id: string, event: React.KeyboardEvent) => void;
  };
  onRowClick?: (row: T) => void;
  onResizeCommit: (id: string, width: number) => void;
  onResizeReset: (id: string) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  /** checkbox overlay（渲染在滚动容器外，横向固定）。 */
  overlaySlot?: React.ReactNode;
  flow?: boolean;
}) {
  useFlowHeader(scrollContainerRef, flow);
  const { resizing, startResize } = useColumnResize(columns, onResizeCommit);

  const widthOf = (id: string) =>
    resizing?.id === id
      ? resizing.width
      : (columns.find((item) => item.id === id)?.width ?? DEFAULT_COLUMN_WIDTH);

  const [viewportWidth, setViewportWidth] = useState(0);
  useLayoutEffect(() => {
    const element = scrollContainerRef.current;
    if (!element) return;
    const update = () => setViewportWidth(element.clientWidth);
    const observer = new ResizeObserver(update);
    observer.observe(element);
    update();
    return () => observer.disconnect();
  }, [scrollContainerRef]);
  const contentWidth =
    columns.reduce((sum, item) => sum + widthOf(item.id), 0) +
    (actionsColumn ? ACTIONS_COLUMN_WIDTH : 0);
  const fillerWidth = Math.max(0, viewportWidth - contentWidth);
  const frozenLeft = (id: string) => {
    let offset = 0;
    for (const column of columns) {
      if (column.id === id) break;
      if (column.frozen) offset += widthOf(column.id);
    }
    return offset;
  };
  const activeDrag = drag.drag;
  const dragSourceIndex = activeDrag
    ? columns.findIndex((item) => item.id === activeDrag.sourceId)
    : -1;
  const insertionLineIndex =
    activeDrag &&
    activeDrag.insertionIndex !== dragSourceIndex &&
    activeDrag.insertionIndex !== dragSourceIndex + 1
      ? activeDrag.insertionIndex
      : null;

  const transition = status.kind === 'ready' ? status.transition : false;

  return (
    <div className={cn('relative flex min-h-0', flow ? 'shrink-0' : 'flex-1')}>
      {overlaySlot}
      <div
        ref={scrollContainerRef}
        onScroll={undefined}
        onPointerMove={drag.onPointerMove}
        onPointerUp={drag.onPointerUp}
        className={cn(
          'min-h-0 min-w-0 flex-1 overflow-auto',
          flow && 'overflow-y-hidden [&_th]:translate-y-(--flow-header-offset)',
        )}
      >
        <table
          className="table-fixed border-separate border-spacing-0 text-left"
          style={{
            width: contentWidth + fillerWidth,
          }}
        >
          <colgroup>
            {columns.map((item) => (
              <col key={item.id} style={{ width: widthOf(item.id) }} />
            ))}
            {fillerWidth > 0 && <col style={{ width: fillerWidth }} />}
            {!!actionsColumn && <col style={{ width: ACTIONS_COLUMN_WIDTH }} />}
          </colgroup>
          <thead>
            <tr>
              {columns.map((item, index) => (
                <th
                  key={item.id}
                  scope="col"
                  tabIndex={0}
                  data-drag-center-x=""
                  className={cn(
                    'sticky top-0 z-10 h-9 select-none border-b border-border bg-background',
                    'px-3 align-middle text-[length:var(--text-meta)] font-medium text-muted-foreground first:pl-0',
                    item.column.align === 'right' && 'text-right',
                    item.frozen && 'z-20',
                    insertionLineIndex === columns.length &&
                      index === columns.length - 1 &&
                      'border-r-2 border-r-primary',
                    drag.drag?.sourceId === item.id && 'opacity-50',
                  )}
                  style={
                    item.frozen ? { left: frozenLeft(item.id) } : undefined
                  }
                  onPointerDown={(event) => {
                    if (item.column.reorderable ?? true) {
                      drag.onPointerDown(item.id, event);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (item.column.reorderable ?? true) {
                      drag.onKeyDown(item.id, event);
                    }
                  }}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {!!item.column.icon && (
                      <item.column.icon className="size-3.5 text-muted-foreground/80" />
                    )}
                    {item.column.header}
                  </span>
                  {!!(item.column.resizable ?? true) && (
                    <button
                      type="button"
                      aria-label={`调整 ${item.column.header} 列宽（拖动；双击恢复默认）`}
                      className={cn(
                        'absolute inset-y-0 right-0 w-1 cursor-col-resize touch-none',
                        'after:absolute after:inset-y-2 after:right-0 after:w-px after:bg-transparent',
                        'hover:after:bg-border',
                      )}
                      onPointerDown={(event) => startResize(item.id, event)}
                      onDoubleClick={() => onResizeReset(item.id)}
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => {
                        event.stopPropagation();
                        if (event.key === 'Home') {
                          event.preventDefault();
                          onResizeReset(item.id);
                        }
                        if (
                          event.key === 'ArrowLeft' ||
                          event.key === 'ArrowRight'
                        ) {
                          event.preventDefault();
                          const width =
                            widthOf(item.id) +
                            (event.key === 'ArrowLeft' ? -16 : 16);
                          onResizeCommit(
                            item.id,
                            Math.min(
                              item.column.maxWidth ?? Infinity,
                              Math.max(item.column.minWidth ?? 96, width),
                            ),
                          );
                        }
                      }}
                    />
                  )}
                  {!!(insertionLineIndex === index) && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-0 left-0 w-0.5 bg-primary"
                    />
                  )}
                </th>
              ))}
              {fillerWidth > 0 && (
                <td
                  aria-hidden="true"
                  className="sticky top-0 z-10 border-b border-border bg-background"
                />
              )}
              {!!actionsColumn && (
                <th
                  scope="col"
                  aria-label="操作"
                  className={cn(
                    'sticky top-0 z-10 h-9 border-b border-border bg-background px-3 text-right',
                    'text-[length:var(--text-meta)] font-medium text-muted-foreground',
                    pinActions && 'z-20',
                  )}
                  style={pinActions ? { right: 0 } : undefined}
                >
                  <span className="inline-flex items-center justify-end gap-1">
                    <EllipsisIcon className="size-3.5" />
                    操作
                  </span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {status.kind !== 'ready' ? (
              <tr>
                <td
                  colSpan={Math.max(
                    1,
                    columns.length +
                      (fillerWidth > 0 ? 1 : 0) +
                      (actionsColumn ? 1 : 0),
                  )}
                  className="h-64 p-0"
                />
              </tr>
            ) : (
              rows.map((row) => {
                const id = rowKey(row);
                const selected = selection?.isRowSelected(id) ?? false;
                return (
                  <tr
                    key={id}
                    data-row-id={id}
                    tabIndex={0}
                    aria-selected={selected || undefined}
                    className={cn(
                      'group/row h-12 border-b border-border transition-colors',
                      'hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none',
                      selected && 'bg-tint',
                      transition && 'pointer-events-none opacity-60',
                    )}
                    onClick={(event) => {
                      const target = event.target as HTMLElement;
                      if (
                        transition ||
                        target.closest(
                          'a,button,input,select,textarea,[role="checkbox"],[role="switch"]',
                        )
                      )
                        return;
                      onRowClick?.(row);
                    }}
                    onKeyDown={(event) => {
                      if (
                        (event.key === 'Enter' || event.key === ' ') &&
                        event.target === event.currentTarget
                      ) {
                        event.preventDefault();
                        onRowClick?.(row);
                      }
                    }}
                  >
                    {columns.map((item) => (
                      <td
                        key={item.id}
                        className={cn(
                          'relative h-12 overflow-hidden border-b border-border/60 px-3 align-middle text-[length:var(--text-meta)] first:pl-0',
                          item.column.align === 'right' && 'text-right',
                          item.frozen && 'sticky z-10 bg-background',
                          selected && item.frozen && 'bg-tint',
                          activeDrag?.sourceId === item.id && 'opacity-40',
                        )}
                        style={
                          item.frozen
                            ? { left: frozenLeft(item.id) }
                            : undefined
                        }
                      >
                        {renderCell(item.column, row)}
                      </td>
                    ))}
                    {fillerWidth > 0 && (
                      <td
                        aria-hidden="true"
                        className="border-b border-border/60"
                      />
                    )}
                    {!!actionsColumn && (
                      <td
                        className={cn(
                          'relative h-12 border-b border-border/60 px-3 text-right align-middle',
                          pinActions && 'sticky z-10 bg-background',
                          selected && pinActions && 'bg-tint',
                        )}
                        style={pinActions ? { right: 0 } : undefined}
                      >
                        {actionsColumn.render(row)}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {status.kind !== 'ready' && (
        <div className="absolute inset-x-0 bottom-0 top-9 overflow-auto bg-background">
          <TableStatusContent status={status} />
        </div>
      )}
      {activeDrag?.mode === 'pointer' && activeDrag.pointerX !== null && (
        <ColumnDragPreview
          column={
            columns.find((item) => item.id === activeDrag.sourceId)?.column
          }
          rows={rows}
          rowKey={rowKey}
          left={activeDrag.pointerX + 12}
          top={scrollContainerRef.current?.getBoundingClientRect().top ?? 0}
        />
      )}
      {!!(drag.drag?.mode === 'keyboard') && (
        <span className="sr-only" role="status">
          正在移动列：左右方向键调整位置，空格提交，Escape 取消
        </span>
      )}
    </div>
  );
}

/** 单元格渲染：自定义 cell 优先，缺省渲染 accessor 文本（空值 —）。 */
function renderCell<T>(column: TableViewColumn<T>, row: T): React.ReactNode {
  if (column.cell) return column.cell(row);
  const value = column.accessor
    ? column.accessor(row)
    : (row as Record<string, unknown>)[column.id];
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

/** 暴露给窄屏卡片的列宽默认值（table-cards 复用）。 */
export { DEFAULT_COLUMN_WIDTH };
