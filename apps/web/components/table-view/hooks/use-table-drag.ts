'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 列拖拽重排状态机：拖动超过 6px 才开始；Escape 取消未提交；
 * 指针抬起提交；支持键盘移动（Space 进入/提交、方向键移动、Escape 取消）；
 * 拖动经过滚动容器边缘时自动滚动。
 */
export type DragState = {
  /** 当前拖动列的稳定标识。 */
  sourceId: string;
  /** 当前插入位置（order 数组下标）。 */
  insertionIndex: number;
  /** 预览横向位置（视口坐标），null 表示键盘模式无预览。 */
  pointerX: number | null;
  /** 交互来源，区分指针和键盘拖动。 */
  mode: 'pointer' | 'keyboard';
};

const DRAG_THRESHOLD = 6;
const EDGE_SCROLL_MARGIN = 48;
const EDGE_SCROLL_SPEED = 12;

/** 列拖拽重排 hook：pointer + 键盘双路径，Escape 取消、边缘自动滚动。 */
export function useColumnDrag(config: {
  order: string[];
  scrollContainerRef: React.RefObject<HTMLElement | null>;
  headerHeight: number;
  onReorder: (sourceId: string, insertionIndex: number) => void;
}): {
  drag: DragState | null;
  /** 列头指针按下：记录起点，未过阈值不算拖动。 */
  onPointerDown: (id: string, event: React.PointerEvent) => void;
  onPointerMove: (event: React.PointerEvent) => void;
  onPointerUp: (event: React.PointerEvent) => void;
  /** 键盘移动：Space 进入、方向键移动、Space 提交、Escape 取消。 */
  onKeyDown: (id: string, event: React.KeyboardEvent) => void;
  cancel: () => void;
} {
  const { order, scrollContainerRef, onReorder } = config;
  const [drag, setDrag] = useState<DragState | null>(null);
  const stateRef = useRef<{
    sourceId: string | null;
    startX: number;
    active: boolean;
    pointerId: number | null;
    insertionIndex: number;
  }>({
    sourceId: null,
    startX: 0,
    active: false,
    pointerId: null,
    insertionIndex: 0,
  });

  const insertionFromPointer = useCallback(
    (clientX: number): number => {
      // 由 data-table 在列头登记中心点（data-drag-cell），此处按 DOM 实测。
      const cells = scrollContainerRef.current?.querySelectorAll<HTMLElement>(
        '[data-drag-center-x]',
      );
      if (!cells || cells.length === 0) return order.length;
      let index = 0;
      cells.forEach((cell, cellIndex) => {
        const rect = cell.getBoundingClientRect();
        if (clientX > rect.left + rect.width / 2) index = cellIndex + 1;
        void cellIndex;
      });
      return index;
    },
    [order.length, scrollContainerRef],
  );

  const autoScroll = useCallback(
    (clientX: number) => {
      const container = scrollContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      if (clientX < rect.left + EDGE_SCROLL_MARGIN) {
        container.scrollLeft -= EDGE_SCROLL_SPEED;
      } else if (clientX > rect.right - EDGE_SCROLL_MARGIN) {
        container.scrollLeft += EDGE_SCROLL_SPEED;
      }
    },
    [scrollContainerRef],
  );

  const onPointerDown = useCallback((id: string, event: React.PointerEvent) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    stateRef.current = {
      sourceId: id,
      startX: event.clientX,
      active: false,
      pointerId: event.pointerId,
      insertionIndex: 0,
    };
  }, []);

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      const state = stateRef.current;
      if (!state.sourceId) return;
      if (!state.active) {
        if (Math.abs(event.clientX - state.startX) < DRAG_THRESHOLD) return;
        state.active = true;
        state.insertionIndex = order.indexOf(state.sourceId);
      }
      const insertionIndex = insertionFromPointer(event.clientX);
      state.insertionIndex = insertionIndex;
      autoScroll(event.clientX);
      setDrag({
        sourceId: state.sourceId,
        insertionIndex,
        pointerX: event.clientX,
        mode: 'pointer',
      });
    },
    [autoScroll, insertionFromPointer, order],
  );

  const commit = useCallback(
    (sourceId: string, insertionIndex: number, keyboard = false) => {
      setDrag(null);
      const from = order.indexOf(sourceId);
      // 落点在移除源列后的数组上下文中解释。
      const adjusted =
        !keyboard && from < insertionIndex
          ? insertionIndex - 1
          : insertionIndex;
      if (adjusted !== from) onReorder(sourceId, adjusted);
    },
    [onReorder, order],
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent) => {
      const state = stateRef.current;
      if (!state.sourceId) return;
      if (state.active) {
        commit(state.sourceId, state.insertionIndex);
      }
      stateRef.current = {
        sourceId: null,
        startX: 0,
        active: false,
        pointerId: null,
        insertionIndex: 0,
      };
      void event;
    },
    [commit],
  );

  const cancel = useCallback(() => {
    stateRef.current = {
      sourceId: null,
      startX: 0,
      active: false,
      pointerId: null,
      insertionIndex: 0,
    };
    setDrag(null);
  }, []);

  useEffect(() => {
    if (drag?.mode !== 'pointer' || drag.pointerX === null) return;
    const pointerX = drag.pointerX;
    let frame = 0;
    const tick = () => {
      if (!stateRef.current.active) return;
      const element = scrollContainerRef.current;
      const previous = element?.scrollLeft;
      autoScroll(pointerX);
      if (element && element.scrollLeft !== previous) {
        const insertionIndex = insertionFromPointer(pointerX);
        stateRef.current.insertionIndex = insertionIndex;
        setDrag((current) =>
          current ? { ...current, insertionIndex } : current,
        );
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [
    drag?.mode,
    drag?.pointerX,
    scrollContainerRef,
    autoScroll,
    insertionFromPointer,
  ]);

  const onKeyDown = useCallback(
    (id: string, event: React.KeyboardEvent) => {
      if (event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault();
        if (drag?.mode === 'keyboard' && drag.sourceId === id)
          commit(id, drag.insertionIndex, true);
        else
          setDrag({
            sourceId: id,
            insertionIndex: order.indexOf(id),
            pointerX: null,
            mode: 'keyboard',
          });
        return;
      }
      if (event.key === 'Escape') {
        cancel();
        return;
      }
      if (drag?.mode !== 'keyboard' || drag.sourceId !== id) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const insertionIndex = Math.max(
          0,
          Math.min(
            order.length - 1,
            drag.insertionIndex + (event.key === 'ArrowLeft' ? -1 : 1),
          ),
        );
        setDrag({ ...drag, insertionIndex });
      }
    },
    [drag, cancel, commit, order],
  );

  // 组件卸载清理监听（window 级 move/up 在 data-table 绑定，这里仅保证卸载置空）。
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && stateRef.current.sourceId) {
        event.preventDefault();
        event.stopImmediatePropagation();
        cancel();
      }
    };
    window.addEventListener('keydown', handleEscape, true);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('keydown', handleEscape, true);
      window.removeEventListener('pointercancel', cancel);
    };
  }, [cancel]);

  return { drag, onPointerDown, onPointerMove, onPointerUp, onKeyDown, cancel };
}
