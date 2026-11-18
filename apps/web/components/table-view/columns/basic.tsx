'use client';

import { format, formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  CalendarIcon,
  CopyIcon,
  ExternalLinkIcon,
  FingerprintIcon,
  HashIcon,
  LinkIcon,
  TextIcon,
  TypeIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

import type { FilterOperator, TableViewColumn, Truncate } from '../types';
import {
  type CommonOptions,
  common,
  EMPTY,
  getter,
  ID_VISIBLE,
  isEmptyValue,
  TruncatedText,
  withCell,
} from './shared';

/** 文本字段允许的筛选操作符子集。 */
export type TextFilterOperators =
  | FilterOperator.Equal
  | FilterOperator.NotEqual
  | FilterOperator.Contains
  | FilterOperator.NotContains;
/** 数值字段允许的筛选操作符子集（eq/neq）。 */
export type NumberFilterOperators =
  | FilterOperator.Equal
  | FilterOperator.NotEqual;
/** 日期字段允许的筛选操作符子集（before/not_before）。 */
export type DateFilterOperators =
  | FilterOperator.Before
  | FilterOperator.NotBefore;

/** 文本列筛选声明：操作符子集由类型限制，kind 由工厂注入。 */
export type TextFilterDef = {
  /** 该字段允许使用的筛选操作符。 */ operators: TextFilterOperators[];
};
/** 数值列筛选声明。 */
export type NumberFilterDef = {
  /** 该字段允许使用的筛选操作符。 */ operators: NumberFilterOperators[];
};
/** 日期列筛选声明：granularity/timeZone 由工厂补默认值。 */
export type DateFilterDef = {
  /** 该字段允许使用的筛选操作符。 */
  operators: DateFilterOperators[];
  /** day 以所选日在 timeZone 的零点为截止时刻。 */
  granularity?: 'day' | 'datetime';
  /** 解释日期边界所使用的 IANA 时区。 */
  timeZone?: string;
};

/** 文本：截断 + 空值占位。 */
export function text<T>(
  key: string,
  header: string,
  opts: CommonOptions<T> & {
    truncate?: Truncate;
    filter?: TextFilterDef;
  } = {},
): TableViewColumn<T> {
  const get = getter(opts, key);
  return {
    ...common(key, header, { ...opts, icon: opts.icon ?? TypeIcon }),
    valueKind: 'text',
    ...(opts.filter
      ? { filter: { kind: 'text', operators: opts.filter.operators } }
      : {}),
    cell: withCell(opts, (row) => {
      const value = get(row);
      if (isEmptyValue(value)) return EMPTY;
      return <TruncatedText text={String(value)} truncate={opts.truncate} />;
    }),
  };
}

/** 双行主列：主文本 + meta 副文本。 */
export function primary<T>(
  key: string,
  header: string,
  opts: CommonOptions<T> & {
    meta?: (row: T) => string | React.ReactNode;
    truncate?: Truncate;
    filter?: TextFilterDef;
  } = {},
): TableViewColumn<T> {
  const get = getter(opts, key);
  return {
    ...common(key, header, {
      ...opts,
      primary: true,
      icon: opts.icon ?? TextIcon,
    }),
    ...(opts.filter
      ? { filter: { kind: 'text', operators: opts.filter.operators } }
      : {}),
    cell: withCell(opts, (row) => {
      const value = get(row);
      const main = isEmptyValue(value) ? EMPTY : String(value);
      const meta = opts.meta?.(row);
      return (
        <div className="grid gap-0.5">
          <TruncatedText
            text={main}
            truncate={opts.truncate}
            className="font-medium"
          />
          {!!(meta !== undefined && meta !== null && meta !== '') && (
            <span
              className={cn(
                'block max-w-[360px] truncate text-[length:var(--text-meta)]',
                'text-muted-foreground',
              )}
            >
              {meta}
            </span>
          )}
        </div>
      );
    }),
  };
}

/** 时间：date-fns 格式化（默认 yyyy-MM-dd），可切相对时间；筛选按 IANA 时区换算截止时刻。 */
export function date<T>(
  key: string,
  header: string,
  opts: CommonOptions<T> & {
    format?: string;
    relative?: boolean;
    filter?: DateFilterDef;
  } = {},
): TableViewColumn<T> {
  const get = getter(opts, key);
  return {
    ...common(key, header, { ...opts, icon: opts.icon ?? CalendarIcon }),
    valueKind: 'date',
    ...(opts.filter
      ? {
          filter: {
            kind: 'date',
            operators: opts.filter.operators,
            granularity: opts.filter.granularity ?? 'day',
            timeZone: opts.filter.timeZone ?? 'Asia/Shanghai',
          },
        }
      : {}),
    cell: withCell(opts, (row) => {
      const value = get(row);
      if (isEmptyValue(value)) return EMPTY;
      const date = new Date(String(value));
      if (Number.isNaN(date.getTime())) return EMPTY;
      const text = opts.relative
        ? formatDistanceToNow(date, { addSuffix: true, locale: zhCN })
        : format(date, opts.format ?? 'yyyy-MM-dd');
      return (
        <span
          className="font-mono text-[length:var(--text-meta)] text-muted-foreground"
          title={String(value)}
        >
          {text}
        </span>
      );
    }),
  };
}

/** 数字：默认右对齐 + tabular-nums，支持自定义格式化。 */
export function number<T>(
  key: string,
  header: string,
  opts: CommonOptions<T> & {
    format?: (value: number) => string;
    precision?: number;
    filter?: NumberFilterDef;
  } = {},
): TableViewColumn<T> {
  const get = getter(opts, key);
  return {
    ...common(key, header, {
      align: 'right',
      ...opts,
      icon: opts.icon ?? HashIcon,
    }),
    valueKind: 'number',
    ...(opts.filter
      ? { filter: { kind: 'number', operators: opts.filter.operators } }
      : {}),
    cell: withCell(opts, (row) => {
      const value = get(row);
      if (isEmptyValue(value)) return EMPTY;
      const parsed = Number(value);
      if (Number.isNaN(parsed)) return EMPTY;
      let text = String(parsed);
      if (opts.format) text = opts.format(parsed);
      else if (opts.precision !== undefined)
        text = parsed.toFixed(opts.precision);
      return <span className="tabular-nums">{text}</span>;
    }),
  };
}

/** 标识：等宽 + 中段截断 + 悬停复制。 */
export function id<T>(
  key: string,
  header: string,
  opts: CommonOptions<T> & {
    display?: 'middle' | 'head' | 'tail' | 'full';
    copy?: boolean;
  } = {},
): TableViewColumn<T> {
  const get = getter(opts, key);
  const display = opts.display ?? 'middle';
  return {
    ...common(key, header, { ...opts, icon: opts.icon ?? FingerprintIcon }),
    cell: withCell(opts, (row) => {
      const value = get(row);
      if (isEmptyValue(value)) return EMPTY;
      const text = String(value);
      let shown = text;
      if (display !== 'full' && text.length > ID_VISIBLE * 2) {
        if (display === 'head') shown = `${text.slice(0, 8)}…`;
        else if (display === 'tail') shown = `…${text.slice(-8)}`;
        else shown = `${text.slice(0, ID_VISIBLE)}…${text.slice(-ID_VISIBLE)}`;
      }
      return (
        <span
          className="inline-flex items-center gap-1 font-mono text-[length:var(--text-meta)]"
          title={text}
        >
          <span>{shown}</span>
          {!!(opts.copy !== false) && (
            <button
              type="button"
              aria-label="复制"
              className={cn(
                'inline-grid size-5 place-items-center rounded opacity-0',
                'transition-control group-focus-within/row:opacity-100',
                'group-hover/row:opacity-100',
              )}
              onClick={(event) => {
                event.stopPropagation();
                void navigator.clipboard
                  .writeText(text)
                  .then(() => toast.success('已复制'));
              }}
            >
              <Icon
                icon={CopyIcon}
                size={12}
                className="text-muted-foreground"
              />
            </button>
          )}
        </span>
      );
    }),
  };
}

/** 链接：值为 URL，渲染为锚文本；external=false 时由路由接管。 */
export function link<T>(
  key: string,
  header: string,
  opts: CommonOptions<T> & {
    external?: boolean;
    label?: (value: string, row: T) => string;
    truncate?: Truncate;
  } = {},
): TableViewColumn<T> {
  const get = getter(opts, key);
  const external = opts.external ?? true;
  return {
    ...common(key, header, { ...opts, icon: opts.icon ?? LinkIcon }),
    cell: withCell(opts, (row) => {
      const value = get(row);
      if (isEmptyValue(value)) return EMPTY;
      const href = String(value);
      const text = opts.label ? opts.label(href, row) : href;
      return (
        <span className="inline-flex items-center gap-0.5">
          <a
            href={href}
            {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
            className="truncate hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            {text}
          </a>
          {external && (
            <ExternalLinkIcon className="size-3 shrink-0 text-muted-foreground" />
          )}
        </span>
      );
    }),
  };
}
