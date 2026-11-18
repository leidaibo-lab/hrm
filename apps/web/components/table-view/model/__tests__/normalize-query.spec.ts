import { FilterOperator, SortDirection } from '@cip/shared';
import { describe, expect, it } from 'vitest';
import {
  canonicalQueryKey,
  datetimeCutoffMs,
  dayCutoffMs,
  defaultTableQuery,
  isValidFilter,
  normalizeQuery,
  zonedWallClockToMs,
} from '../normalize-query';

describe('defaultTableQuery', () => {
  it('初始值为 page 1 / pageSize 20 / 空 q / 空 filters / 空 sort', () => {
    expect(defaultTableQuery()).toEqual({
      page: 1,
      pageSize: 20,
      q: '',
      filters: [],
      sort: [],
    });
  });

  it('defaultQuery 覆盖且不影响外部引用', () => {
    const sort = [{ field: 'createdAt', direction: SortDirection.Desc }];
    const query = defaultTableQuery({ pageSize: 50, sort });
    expect(query.pageSize).toBe(50);
    expect(query.sort).toEqual(sort);
    sort.push({ field: 'name', direction: SortDirection.Asc });
    expect(query.sort).toHaveLength(1);
  });
});

describe('normalizeQuery', () => {
  const base = defaultTableQuery();

  it('修复非法页码与每页条数', () => {
    expect(normalizeQuery({ page: 0, pageSize: 33 }, base)).toMatchObject({
      page: 1,
      pageSize: 20,
    });
  });

  it('剔除不完整筛选草稿与非法排序', () => {
    const query = normalizeQuery(
      {
        filters: [
          {
            kind: 'text',
            field: 'name',
            operator: FilterOperator.Contains,
            value: '',
          },
          {
            kind: 'number',
            field: 'age',
            operator: FilterOperator.Equal,
            value: Number.NaN,
          },
          {
            kind: 'enum',
            field: 'status',
            operator: FilterOperator.Equal,
            values: [],
          },
          {
            kind: 'text',
            field: 'name',
            operator: FilterOperator.Contains,
            value: 'a',
          },
        ],
        sort: [
          { field: 'createdAt', direction: 'down' as never },
          { field: 'name', direction: SortDirection.Asc },
        ],
      },
      base,
    );
    expect(query.filters).toHaveLength(1);
    expect(query.sort).toEqual([
      { field: 'name', direction: SortDirection.Asc },
    ]);
  });

  it('isValidFilter 区分完整条件与草稿', () => {
    expect(
      isValidFilter({
        kind: 'text',
        field: 'f',
        operator: FilterOperator.Contains,
        value: 'x',
      }),
    ).toBe(true);
    expect(
      isValidFilter({
        kind: 'date',
        field: 'f',
        operator: FilterOperator.Before,
        value: Number.NaN,
      }),
    ).toBe(false);
  });
});

describe('canonicalQueryKey', () => {
  it('筛选字段与枚举值排序规范化，sort 顺序保留', () => {
    const a = defaultTableQuery({
      filters: [
        {
          kind: 'text',
          field: 'name',
          operator: FilterOperator.Contains,
          value: 'x',
        },
        {
          kind: 'enum',
          field: 'status',
          operator: FilterOperator.Equal,
          values: ['b', 'a'],
        },
      ],
      sort: [
        { field: 'createdAt', direction: SortDirection.Desc },
        { field: 'name', direction: SortDirection.Asc },
      ],
    });
    const b = defaultTableQuery({
      filters: [
        {
          kind: 'enum',
          field: 'status',
          operator: FilterOperator.Equal,
          values: ['a', 'b'],
        },
        {
          kind: 'text',
          field: 'name',
          operator: FilterOperator.Contains,
          value: 'x',
        },
      ],
      sort: [
        { field: 'createdAt', direction: SortDirection.Desc },
        { field: 'name', direction: SortDirection.Asc },
      ],
    });
    expect(canonicalQueryKey(a)).toBe(canonicalQueryKey(b));

    const swappedSort = defaultTableQuery({
      filters: a.filters,
      sort: [a.sort[1], a.sort[0]],
    });
    expect(canonicalQueryKey(swappedSort)).not.toBe(canonicalQueryKey(a));
  });

  it('页码与关键词变化产生不同键', () => {
    expect(canonicalQueryKey(defaultTableQuery({ page: 1 }))).not.toBe(
      canonicalQueryKey(defaultTableQuery({ page: 2 })),
    );
    expect(canonicalQueryKey(defaultTableQuery({ q: 'a' }))).not.toBe(
      canonicalQueryKey(defaultTableQuery({ q: 'b' })),
    );
  });
});

describe('时区截止时刻换算', () => {
  it('Asia/Shanghai（UTC+8）当日零点 = 前一日 16:00 UTC', () => {
    expect(dayCutoffMs('2026-11-01', 'Asia/Shanghai')).toBe(
      Date.UTC(2026, 9, 31, 16, 0, 0),
    );
  });

  it('America/New_York 夏令时与非夏令时分别偏移 -4/-5 小时', () => {
    // 2026-07-01 处于 EDT（UTC-4）：当日零点 = 04:00 UTC
    expect(dayCutoffMs('2026-07-01', 'America/New_York')).toBe(
      Date.UTC(2026, 6, 1, 4, 0, 0),
    );
    // 2026-01-15 处于 EST（UTC-5）：当日零点 = 05:00 UTC
    expect(dayCutoffMs('2026-01-15', 'America/New_York')).toBe(
      Date.UTC(2026, 0, 15, 5, 0, 0),
    );
  });

  it('datetime 粒度按该时区当日时刻换算', () => {
    expect(datetimeCutoffMs('2026-11-01T08:30', 'Asia/Shanghai')).toBe(
      Date.UTC(2026, 10, 1, 0, 30, 0),
    );
  });

  it('zonedWallClockToMs 与 UTC 直算在 UTC 时区一致', () => {
    expect(zonedWallClockToMs({ year: 2026, month: 3, day: 1 }, 'UTC')).toBe(
      Date.UTC(2026, 2, 1),
    );
  });
});
