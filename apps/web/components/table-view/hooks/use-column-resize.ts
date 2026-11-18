'use client';
import { useEffect, useRef, useState } from 'react';
import type { RenderColumn } from '../model/render-state';

/** 列宽草稿与指针生命周期，结束提交、Esc 取消、卸载清理监听。 */
export function useColumnResize<T>(
  columns: RenderColumn<T>[],
  onResizeCommit: (id: string, width: number) => void,
) {
  const cleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanupRef.current?.(), []);
  const [resizing, setResizing] = useState<{
    id: string;
    width: number;
  } | null>(null);

  const startResize = (id: string, event: React.PointerEvent) => {
    cleanupRef.current?.();
    event.stopPropagation();
    event.preventDefault();
    const column = columns.find((item) => item.id === id);
    const startX = event.clientX;
    const startWidth = column?.width ?? 160;
    let width = startWidth;
    const cleanup = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', handleEscape);
      cleanupRef.current = null;
      setResizing(null);
    };
    const move = (pointer: PointerEvent) => {
      width = Math.min(
        column?.column.maxWidth ?? Infinity,
        Math.max(
          column?.column.minWidth ?? 96,
          startWidth + pointer.clientX - startX,
        ),
      );
      setResizing({ id, width });
    };
    const finish = () => {
      cleanup();
      if (width !== startWidth) onResizeCommit(id, width);
    };
    const cancel = () => cleanup();
    const handleEscape = (key: KeyboardEvent) => {
      if (key.key === 'Escape') {
        key.stopPropagation();
        cleanup();
      }
    };
    cleanupRef.current = cleanup;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', handleEscape);
  };

  return { resizing, startResize };
}
