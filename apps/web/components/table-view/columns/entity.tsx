'use client';

import {
  ActivityIcon,
  TagIcon,
  TagsIcon,
  ToggleLeftIcon,
  UserIcon,
} from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

import type {
  ColumnOptionMap,
  FilterOperator,
  TableViewColumn,
} from '../types';
import {
  type CommonOptions,
  common,
  EMPTY,
  getter,
  isEmptyValue,
  TONE_CHIP,
  TONE_DOT,
  TruncatedText,
  withCell,
} from './shared';

/** 枚举字段允许的筛选操作符子集（eq 任一命中 / neq 全部排除）。 */
export type EnumFilterOperators =
  | FilterOperator.Equal
  | FilterOperator.NotEqual;

/** 枚举列筛选声明：kind/options 由工厂从选项映射注入。 */
export type EnumFilterDef = {
  /** 该字段允许使用的筛选操作符。 */
  operators: EnumFilterOperators[];
  /** 多选（eq 任一命中 / neq 全部排除）；缺省单选。 */
  multiple?: boolean;
};

/** 状态：圆点/图标 + 文本（无底色）；tone 集中渲染。 */
export function status<T>(
  key: string,
  header: string,
  map: ColumnOptionMap,
  opts: CommonOptions<T> & { filter?: EnumFilterDef } = {},
): TableViewColumn<T> {
  const get = getter(opts, key);
  return {
    ...common(key, header, { ...opts, icon: opts.icon ?? ActivityIcon }),
    ...(opts.filter
      ? {
          filter: {
            kind: 'enum',
            operators: opts.filter.operators,
            multiple: opts.filter.multiple,
            options: Object.entries(map).map(([value, item]) => ({
              value,
              label: item.label,
            })),
          },
        }
      : {}),
    cell: withCell(opts, (row) => {
      const value = get(row);
      if (isEmptyValue(value)) return EMPTY;
      const semantic = map[String(value)];
      if (!semantic) return String(value);
      return (
        <span className="inline-flex items-center gap-1.5 text-[length:var(--text-meta)]">
          {semantic.icon ? (
            <Icon
              icon={semantic.icon}
              size={14}
              className="text-muted-foreground"
            />
          ) : (
            <span
              className={cn('size-1.5 rounded-full', TONE_DOT[semantic.tone])}
            />
          )}
          {semantic.label}
        </span>
      );
    }),
  };
}

/** 单选芯片：tone 底色 chip（Notion select 形态）。 */
export function select<T>(
  key: string,
  header: string,
  map: ColumnOptionMap,
  opts: CommonOptions<T> & { filter?: EnumFilterDef } = {},
): TableViewColumn<T> {
  const get = getter(opts, key);
  return {
    ...common(key, header, { ...opts, icon: opts.icon ?? TagIcon }),
    ...(opts.filter
      ? {
          filter: {
            kind: 'enum',
            operators: opts.filter.operators,
            multiple: opts.filter.multiple,
            options: Object.entries(map).map(([value, item]) => ({
              value,
              label: item.label,
            })),
          },
        }
      : {}),
    cell: withCell(opts, (row) => {
      const value = get(row);
      if (isEmptyValue(value)) return EMPTY;
      const semantic = map[String(value)];
      const label = semantic ? semantic.label : String(value);
      return (
        <span
          className={cn(
            'inline-flex max-w-[160px] items-center gap-1 truncate rounded-md px-1.5 py-0.5',
            'text-[length:var(--text-meta)]',
            semantic ? TONE_CHIP[semantic.tone] : 'bg-muted text-foreground',
          )}
          title={label}
        >
          {semantic?.icon && <semantic.icon className="size-3 shrink-0" />}
          <span className="truncate">{label}</span>
        </span>
      );
    }),
  };
}

/** 多选芯片：超出 max 收敛为 +N；显式筛选使用 eq/neq 的集合交集语义。 */
export function multiselect<T>(
  key: string,
  header: string,
  map: ColumnOptionMap,
  opts: CommonOptions<T> & { max?: number; filter?: EnumFilterDef } = {},
): TableViewColumn<T> {
  const get = getter(opts, key);
  const max = opts.max ?? 3;
  return {
    ...common(key, header, { ...opts, icon: opts.icon ?? TagsIcon }),
    ...(opts.filter
      ? {
          filter: {
            kind: 'enum' as const,
            operators: opts.filter.operators,
            multiple: opts.filter.multiple ?? true,
            options: Object.entries(map).map(([value, item]) => ({
              value,
              label: item.label,
            })),
          },
        }
      : {}),
    cell: withCell(opts, (row) => {
      const value = get(row);
      if (isEmptyValue(value)) return EMPTY;
      const list = (Array.isArray(value) ? value : [value]).map(String);
      const shown = list.slice(0, max);
      const rest = list.length - shown.length;
      return (
        <span className="inline-flex flex-wrap items-center gap-1">
          {shown.map((item) => {
            const semantic = map[item];
            const label = semantic ? semantic.label : item;
            return (
              <span
                key={item}
                className={cn(
                  'inline-flex max-w-[140px] items-center truncate rounded-md px-1.5 py-0.5',
                  'text-[length:var(--text-meta)]',
                  semantic
                    ? TONE_CHIP[semantic.tone]
                    : 'bg-muted text-foreground',
                )}
                title={label}
              >
                {semantic?.icon && (
                  <semantic.icon className="size-3 shrink-0" />
                )}
                <span className="truncate">{label}</span>
              </span>
            );
          })}
          {rest > 0 && (
            <span
              className="text-[length:var(--text-meta)] text-muted-foreground"
              title={list.join('、')}
            >
              +{rest}
            </span>
          )}
        </span>
      );
    }),
  };
}

/** 开关：布尔展示态（不交互——写操作走行/批量动作）。 */
export function switchColumn<T>(
  key: string,
  header: string,
  opts: CommonOptions<T> & {
    trueLabel?: string;
    falseLabel?: string;
  } = {},
): TableViewColumn<T> {
  const get = getter(opts, key);
  const trueLabel = opts.trueLabel ?? '启用';
  const falseLabel = opts.falseLabel ?? '停用';
  return {
    ...common(key, header, { ...opts, icon: opts.icon ?? ToggleLeftIcon }),
    cell: withCell(opts, (row) => {
      const value = get(row);
      const checked = value === true;
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 text-[length:var(--text-meta)]',
            'text-muted-foreground',
          )}
        >
          <Switch checked={checked} disabled aria-hidden="true" />
          {checked ? trueLabel : falseLabel}
        </span>
      );
    }),
  };
}

/** 人员：头像（回退首字符）+ 姓名，可选 meta 副文本。 */
export function person<T>(
  key: string,
  header: string,
  opts: CommonOptions<T> & {
    avatar?: (row: T) => string | undefined;
    filter?: EnumFilterDef & { options: ColumnOptionMap };
    meta?: (row: T) => string;
  } = {},
): TableViewColumn<T> {
  const get = getter(opts, key);
  return {
    ...common(key, header, { ...opts, icon: opts.icon ?? UserIcon }),
    ...(opts.filter
      ? {
          filter: {
            kind: 'enum' as const,
            operators: opts.filter.operators,
            multiple: opts.filter.multiple,
            options: Object.entries(opts.filter.options).map(
              ([value, item]) => ({ value, label: item.label }),
            ),
          },
        }
      : {}),
    cell: withCell(opts, (row) => {
      const value = get(row);
      if (isEmptyValue(value)) return EMPTY;
      const name = String(value);
      const avatarUrl = opts.avatar?.(row);
      const meta = opts.meta?.(row);
      return (
        <div className="flex items-center gap-2">
          <Avatar className="size-6">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
            <AvatarFallback className="text-[length:var(--text-meta)]">
              {Array.from(name)[0] ?? '?'}
            </AvatarFallback>
          </Avatar>
          <div className="grid gap-0.5">
            <TruncatedText text={name} className="font-medium" />
            {meta && (
              <span className="truncate text-[length:var(--text-meta)] text-muted-foreground">
                {meta}
              </span>
            )}
          </div>
        </div>
      );
    }),
  };
}
