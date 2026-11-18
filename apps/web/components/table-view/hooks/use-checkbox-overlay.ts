'use client';

import { useCallback, useState } from 'react';

/**
 * checkbox overlay 几何与可见性：
 * overlay 不占真实列宽，横向滚动不移动、纵向随可见行与 sticky 表头对齐；
 * 未选中时默认隐藏，悬浮行显示该行 checkbox，悬浮 gutter 显示整列。
 */
export function useCheckboxOverlay(config: {
  rowsCount: number;
  headerHeight: number;
  rowHeight: number;
  selectedIds: readonly string[];
}): {
  /** gutter 悬浮时显示全部可见行 checkbox。 */
  gutterHovered: boolean;
  setGutterHovered: (hovered: boolean) => void;
  hoveredRowIndex: number | null;
  setHoveredRowIndex: (index: number | null) => void;
  /** 行 checkbox 是否可见（悬浮行/整列悬浮/已选/触屏常显由调用方叠加）。 */
  isRowCheckboxVisible: (index: number, id: string) => boolean;
  /** 行 checkbox 相对 overlay 顶部的 translateY。 */
  rowOffset: (index: number) => number;
} {
  const { rowsCount, headerHeight, rowHeight, selectedIds } = config;
  const [gutterHovered, setGutterHovered] = useState(false);
  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null);

  const isRowCheckboxVisible = useCallback(
    (index: number, id: string) => {
      if (selectedIds.includes(id)) return true;
      if (gutterHovered) return index < rowsCount;
      return hoveredRowIndex === index;
    },
    [gutterHovered, hoveredRowIndex, rowsCount, selectedIds],
  );

  const rowOffset = useCallback(
    (index: number) => headerHeight + index * rowHeight,
    [headerHeight, rowHeight],
  );

  return {
    gutterHovered,
    setGutterHovered,
    hoveredRowIndex,
    setHoveredRowIndex,
    isRowCheckboxVisible,
    rowOffset,
  };
}
