'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OptionTone, TableViewColumn, Truncate } from '../types';

export const EMPTY = '—';
/** id 列中段/头尾截断的保留字符数。 */
export const ID_VISIBLE = 4;

/** 列未声明最小宽度时采用的像素下限。 */
export const DEFAULT_MIN_WIDTH = 96;

/**
 * 工厂公共入参：取值/覆盖渲染/表头图标/尺寸/能力开关。
 * 能力默认开启；`primary` 列默认不可隐藏（hideable 显式给 true 才可隐藏）。
 */
export type CommonOptions<T> = {
  /** 从行数据提取展示、排序或筛选值。 */
  accessor?: (row: T) => unknown;
  /** 覆盖默认渲染（逃生舱：工厂默认形态不满足时直接给 cell）。 */
  cell?: (row: T) => React.ReactNode;
  /** 展示图标；省略时由所在组件决定是否使用默认图标。 */
  icon?: LucideIcon;
  /** 单元格内容的水平对齐方向。 */
  align?: 'left' | 'right';
  /** 列宽，单位 px。 */
  width?: number;
  /** 列允许的最小宽度，单位 px。 */
  minWidth?: number;
  /** 列允许的最大宽度，单位 px。 */
  maxWidth?: number;
  /** 是否提供该字段的排序能力。 */
  sortable?: boolean;
  /** 是否允许用户拖拽调整列宽。 */
  resizable?: boolean;
  /** 窄屏收敛时优先隐藏的次要列。 */
  secondary?: boolean;
  /** 窄屏卡片用于标题的主语义列。 */
  primary?: boolean;
  /** 是否允许用户隐藏该列。 */
  hideable?: boolean;
  /** 是否允许将该列冻结在滚动区域左侧。 */
  freezable?: boolean;
  /** 是否允许用户调整该列位置。 */
  reorderable?: boolean;
};

/** 取值函数：优先显式 accessor，否则按列 id 取属性。 */
export function getter<T>(
  opts: CommonOptions<T>,
  key: string,
): (row: T) => unknown {
  return opts.accessor ?? ((row: T) => (row as Record<string, unknown>)[key]);
}

/** 组装公共列字段（id/header/icon/尺寸/能力声明/默认 minWidth）。 */
export function common<T>(
  id: string,
  header: string,
  opts: CommonOptions<T>,
): Omit<TableViewColumn<T>, 'cell' | 'filter'> {
  return {
    id,
    header,
    icon: opts.icon,
    align: opts.align,
    width: opts.width,
    minWidth: opts.minWidth ?? DEFAULT_MIN_WIDTH,
    maxWidth: opts.maxWidth,
    sortable: opts.sortable,
    resizable: opts.resizable,
    secondary: opts.secondary,
    primary: opts.primary,
    hideable: opts.primary ? (opts.hideable ?? false) : (opts.hideable ?? true),
    freezable: opts.freezable ?? true,
    reorderable: opts.reorderable ?? true,
    accessor: opts.accessor,
  };
}

/** 渲染函数：cell 覆盖优先，否则默认渲染。 */
export function withCell<T>(
  opts: CommonOptions<T>,
  fallback: (row: T) => React.ReactNode,
): (row: T) => React.ReactNode {
  return opts.cell ?? fallback;
}

/** 空值判定：null / undefined / '' / 空数组；0 与 false 是合法数据。 */
export function isEmptyValue(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  );
}

/** 截断策略 → 样式/内容/title（middle 为 JS 字符串截断，其余 CSS）。 */
export function truncateOptions(
  truncate: Truncate | undefined,
  text: string,
): {
  className?: string;
  style?: React.CSSProperties;
  content?: string;
  title?: string;
} {
  const t = truncate ?? true;
  if (t === true) return { className: 'truncate', title: text };
  if (t === false) return {};
  if (typeof t === 'number') {
    return {
      style: {
        display: '-webkit-box',
        WebkitLineClamp: t,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      },
      title: text,
    };
  }
  if (text.length <= t.middle * 2) return { title: text };
  return {
    content: `${text.slice(0, t.middle)}…${text.slice(-t.middle)}`,
    title: text,
  };
}

/** 截断文本：样式随策略，全文进 title。 */
export function TruncatedText({
  text,
  truncate,
  className,
}: {
  text: string;
  truncate?: Truncate;
  className?: string;
}) {
  const t = truncateOptions(truncate, text);
  return (
    <span
      className={cn(className, t.className)}
      style={t.style}
      title={t.title}
    >
      {t.content ?? text}
    </span>
  );
}

/** 语义色调 → 状态点色（集中映射，禁止业务传 class）。 */
export const TONE_DOT: Record<OptionTone, string> = {
  success: 'bg-success',
  neutral: 'bg-faint',
  warning: 'bg-warning',
  danger: 'bg-destructive',
};

/** 语义色调 → chip 底色/文字（集中映射）。 */
export const TONE_CHIP: Record<OptionTone, string> = {
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-destructive/10 text-destructive',
  neutral: 'bg-muted text-foreground',
};
