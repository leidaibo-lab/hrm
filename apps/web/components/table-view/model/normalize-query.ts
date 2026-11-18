import { FilterOperator, SortDirection } from '@cip/shared';
import { z } from 'zod';
import type { FilterCondition, QueryChangeReason, TableQuery } from '../types';

/**
 * 查询状态纯函数（无副作用）：规范化、规范化缓存键与日期截止时刻换算。
 * 有效状态为 page/pageSize/q/filters/sort；筛选编辑中的未完成草稿不属于有效查询。
 */

export const DEFAULT_PAGE_SIZE = 20;
/** 每页条数白名单。 */
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
export const DEFAULT_MAX_SORT_RULES = 5;

/** 页面初始查询：可由 defaultQuery 覆盖。 */
export function defaultTableQuery(
  defaultQuery?: Partial<TableQuery>,
): TableQuery {
  const base: TableQuery = {
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    q: '',
    filters: [],
    sort: [],
  };
  return {
    ...base,
    ...defaultQuery,
    // defaultQuery 之外的键不可注入；filters/sort 深拷贝避免外部可变引用。
    filters: (defaultQuery?.filters ?? []).map((filter) => ({ ...filter })),
    sort: (defaultQuery?.sort ?? []).map((rule) => ({ ...rule })),
  };
}

/** sessionStorage 存储形态校验：损坏/过期数据由调用方清理并退回默认值。 */
export const tableQuerySchema = z.object({
  page: z.number().int().min(1).catch(1),
  pageSize: z
    .number()
    .int()
    .refine((value) => (PAGE_SIZE_OPTIONS as readonly number[]).includes(value))
    .catch(DEFAULT_PAGE_SIZE),
  q: z.string().catch(''),
  filters: z
    .array(
      z.discriminatedUnion('kind', [
        z.object({
          kind: z.literal('text'),
          field: z.string().min(1),
          operator: z.enum([
            FilterOperator.Equal,
            FilterOperator.NotEqual,
            FilterOperator.Contains,
            FilterOperator.NotContains,
          ]),
          value: z.string(),
        }),
        z.object({
          kind: z.literal('number'),
          field: z.string().min(1),
          operator: z.enum([FilterOperator.Equal, FilterOperator.NotEqual]),
          value: z.number().finite(),
        }),
        z.object({
          kind: z.literal('enum'),
          field: z.string().min(1),
          operator: z.enum([FilterOperator.Equal, FilterOperator.NotEqual]),
          values: z.array(z.string()),
        }),
        z.object({
          kind: z.literal('date'),
          field: z.string().min(1),
          operator: z.enum([FilterOperator.Before, FilterOperator.NotBefore]),
          value: z.number().finite(),
        }),
      ]),
    )
    .catch([]),
  sort: z
    .array(
      z.object({
        field: z.string().min(1),
        direction: z.enum([SortDirection.Asc, SortDirection.Desc]),
      }),
    )
    .catch([]),
});

/** 过滤掉不完整/非法的筛选条件（草稿不入有效查询）。 */
export function isValidFilter(filter: FilterCondition): boolean {
  switch (filter.kind) {
    case 'text':
      return filter.value.length > 0;
    case 'number':
      return Number.isFinite(filter.value);
    case 'enum':
      return filter.values.length > 0;
    case 'date':
      return (
        Number.isFinite(filter.value) &&
        Math.abs(filter.value) <= 8_640_000_000_000_000
      );
  }
}

/** 规范化查询：边界修复 + 草稿剔除；不改变 sort 顺序。 */
export function normalizeQuery(
  input: Partial<TableQuery>,
  defaultQuery: TableQuery,
): TableQuery {
  const base = { ...defaultQuery, ...input };
  const pageSize = (PAGE_SIZE_OPTIONS as readonly number[]).includes(
    base.pageSize,
  )
    ? base.pageSize
    : DEFAULT_PAGE_SIZE;
  return {
    page: Math.max(1, Math.floor(base.page) || 1),
    pageSize,
    q: typeof base.q === 'string' ? base.q.trim() : '',
    filters: Array.isArray(base.filters)
      ? base.filters
          .filter(isValidFilter)
          .filter(
            (filter, index, all) =>
              all.findIndex((item) => item.field === filter.field) === index,
          )
          .map((filter) =>
            filter.kind === 'enum'
              ? { ...filter, values: [...new Set(filter.values)] }
              : { ...filter },
          )
      : [],
    sort: Array.isArray(base.sort)
      ? base.sort
          .filter(
            (rule) =>
              typeof rule?.field === 'string' &&
              (rule.direction === SortDirection.Asc ||
                rule.direction === SortDirection.Desc),
          )
          .filter(
            (rule, index, all) =>
              all.findIndex((item) => item.field === rule.field) === index,
          )
          .slice(0, 5)
      : [],
  };
}

/**
 * 规范化缓存键字符串：筛选按字段排序、枚举值排序（不影响语义），sort 顺序保留。
 * scope 不在此序列化（缓存键组装处独立携带 scope 键）。
 */
export function canonicalQueryKey(query: TableQuery): string {
  const filters = [...query.filters]
    .sort((a, b) => a.field.localeCompare(b.field))
    .map((filter) => {
      if (filter.kind === 'enum') {
        return [
          filter.kind,
          filter.field,
          filter.operator,
          [...filter.values].sort(),
        ];
      }
      return [filter.kind, filter.field, filter.operator, String(filter.value)];
    });
  const sort = query.sort.map((rule) => [rule.field, rule.direction]);
  return JSON.stringify([query.page, query.pageSize, query.q, filters, sort]);
}

/**
 * IANA 时区下的墙钟时刻 → UTC 毫秒（两次迭代收敛，处理 DST 边界）。
 * day 粒度：该时区当日零点；datetime 粒度：该时区的当日时刻。
 * 不用宿主本地时区隐式解释日期。
 */
export function zonedWallClockToMs(
  wallClock: {
    year: number;
    month: number;
    day: number;
    hour?: number;
    minute?: number;
  },
  timeZone: string,
): number {
  const { year, month, day } = wallClock;
  const hour = wallClock.hour ?? 0;
  const minute = wallClock.minute ?? 0;
  // 目标墙钟的 UTC 表示；迭代求「在该时区墙钟恰好等于目标的 UTC 时刻」。
  const target = Date.UTC(year, month - 1, day, hour, minute, 0);
  let ms = target;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  // 两次迭代收敛（第二轮修正 DST 边界导致的偏移跳变）。
  for (let i = 0; i < 2; i += 1) {
    const parts = formatter.formatToParts(new Date(ms));
    const get = (type: string) =>
      Number(parts.find((part) => part.type === type)?.value ?? '0');
    const wallAsUtc = Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour'),
      get('minute'),
      get('second'),
    );
    ms += target - wallAsUtc;
  }
  const result = formatter.formatToParts(new Date(ms));
  const part = (type: string) =>
    Number(result.find((item) => item.type === type)?.value);
  if (
    part('year') !== year ||
    part('month') !== month ||
    part('day') !== day ||
    part('hour') !== hour ||
    part('minute') !== minute
  )
    return Number.NaN;
  return ms;
}

/** 日期筛选输入（day 粒度 'YYYY-MM-DD'）→ 该时区当日零点毫秒。 */
export function dayCutoffMs(dateStr: string, timeZone: string): number {
  const [year, month, day] = dateStr.split('-').map(Number);
  return zonedWallClockToMs({ year, month, day }, timeZone);
}

/** 日期筛选输入（datetime 粒度 'YYYY-MM-DDTHH:mm'）→ 该时区当日时刻毫秒。 */
export function datetimeCutoffMs(
  datetimeStr: string,
  timeZone: string,
): number {
  const [datePart, timePart = '00:00'] = datetimeStr.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  return zonedWallClockToMs(
    { year, month, day, hour: hour || 0, minute: minute || 0 },
    timeZone,
  );
}

/** 原因集合（运行时完整性自检用）。 */
export const QUERY_CHANGE_REASONS: readonly QueryChangeReason[] = [
  'search',
  'filter',
  'sort',
  'page',
  'pageSize',
  'reset',
  'scope',
  'pageCorrection',
];
