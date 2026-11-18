import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  buildTableQuerySchema,
  dateOperators,
  defineTableQuery,
  enumOperators,
  field,
  numberOperators,
  planTableQuery,
  SortDirection,
  tableQueryResponse,
  textOperators,
} from '../table-query';

const def = defineTableQuery({
  fields: {
    name: field.text({
      searchable: true,
      sortable: true,
      filter: textOperators,
    }),
    age: field.number({ sortable: true, filter: numberOperators }),
    status: field.enum(['active', 'suspended'], {
      sortable: true,
      filter: enumOperators,
    }),
    createdAt: field.date({ sortable: true, filter: dateOperators }),
  },
  defaultSort: [{ field: 'createdAt', direction: SortDirection.Desc }],
  maxPageSize: 100,
  maxSortRules: 5,
});

const schema = buildTableQuerySchema(def, {
  scope: z.object({ providerId: z.string().uuid() }).partial(),
});

const parse = (body: unknown) => schema.parse(body);

describe('buildTableQuerySchema：字段与操作符白名单', () => {
  it('合法请求解析成功并补齐默认值', () => {
    const parsed = parse({
      page: 2,
      pageSize: 50,
      q: ' 张 ',
      scope: { providerId: '3f2504e0-4f89-11d3-9a0c-0305e82c3301' },
      filters: [
        { field: 'status', operator: 'eq', values: ['active'] },
        {
          field: 'createdAt',
          operator: 'not_before',
          value: '2026-10-31T16:00:00.000Z',
        },
      ],
      sort: [
        { field: 'createdAt', direction: 'desc' },
        { field: 'name', direction: 'asc' },
      ],
    }) as Record<string, unknown>;
    expect(parsed).toMatchObject({
      page: 2,
      pageSize: 50,
      filters: [
        { field: 'status', operator: 'eq', values: ['active'] },
        {
          field: 'createdAt',
          operator: 'not_before',
          value: '2026-10-31T16:00:00.000Z',
        },
      ],
    });
    expect(parsed.sort).toEqual([
      { field: 'createdAt', direction: 'desc' },
      { field: 'name', direction: 'asc' },
    ]);
  });

  it('拒绝白名单外字段', () => {
    expect(() =>
      parse({
        filters: [{ field: 'passwordHash', operator: 'eq', value: 'x' }],
      }),
    ).toThrow();
  });

  it('拒绝同字段重复筛选', () => {
    expect(() =>
      parse({
        filters: [
          { field: 'name', operator: 'eq', value: 'a' },
          { field: 'name', operator: 'contains', value: 'b' },
        ],
      }),
    ).toThrow();
  });

  it('拒绝字段类型不允许的操作符组合', () => {
    // date 字段只允许 before/not_before
    expect(() =>
      parse({
        filters: [{ field: 'createdAt', operator: 'eq', value: 'x' }],
      }),
    ).toThrow();
    // enum 字段不允许 contains
    expect(() =>
      parse({
        filters: [{ field: 'status', operator: 'contains', value: 'a' }],
      }),
    ).toThrow();
    // text 字段不允许 before
    expect(() =>
      parse({
        filters: [{ field: 'name', operator: 'before', value: 'a' }],
      }),
    ).toThrow();
  });

  it('拒绝值形态不符与非法枚举值', () => {
    expect(() =>
      parse({
        filters: [{ field: 'age', operator: 'eq', value: 'not-a-number' }],
      }),
    ).toThrow();
    expect(() =>
      parse({
        filters: [{ field: 'status', operator: 'eq', values: ['unknown'] }],
      }),
    ).toThrow();
    expect(() =>
      parse({
        filters: [
          {
            field: 'createdAt',
            operator: 'before',
            value: '2026-10-31 16:00:00',
          },
        ],
      }),
    ).toThrow();
  });

  it('拒绝重复排序字段与超过上限的规则数', () => {
    expect(() =>
      parse({
        sort: [
          { field: 'name', direction: 'asc' },
          { field: 'name', direction: 'desc' },
        ],
      }),
    ).toThrow();
    expect(() =>
      parse({
        sort: [
          { field: 'name', direction: 'asc' },
          { field: 'age', direction: 'asc' },
          { field: 'status', direction: 'asc' },
          { field: 'createdAt', direction: 'asc' },
          { field: 'name', direction: 'desc' },
        ],
      }),
    ).toThrow();
  });

  it('拒绝超限分页和未声明顶层键', () => {
    expect(() => parse({ pageSize: 101 })).toThrow();
    expect(() =>
      parse({ sql: 'DROP TABLE users', filters: [], sort: [] }),
    ).toThrow();
  });

  it('未声明 scope 的定义不产生 scope 字段', () => {
    const plain = buildTableQuerySchema(def);
    const parsed = plain.parse({}) as Record<string, unknown>;
    expect('scope' in parsed).toBe(false);
  });
});

describe('planTableQuery：规范化', () => {
  it('空排序落默认排序，q 去首尾空白，无 scope 为 null', () => {
    const request = planTableQuery(def, {
      page: 1,
      pageSize: 20,
      q: '  ',
      filters: [],
      sort: [],
    });
    expect(request.sort).toEqual([
      { field: 'createdAt', direction: SortDirection.Desc },
    ]);
    expect(request.q).toBeNull();
    expect(request.scope).toBeNull();
  });

  it('筛选条件标注字段类型，保留多列排序顺序', () => {
    const request = planTableQuery(
      def,
      parse({
        q: '张',
        filters: [
          { field: 'name', operator: 'contains', value: '张%' },
          { field: 'age', operator: 'neq', value: 3 },
        ],
        sort: [
          { field: 'name', direction: 'asc' },
          { field: 'age', direction: 'desc' },
        ],
      }) as never,
    );
    expect(request.filters).toEqual([
      { field: 'name', kind: 'text', operator: 'contains', value: '张%' },
      { field: 'age', kind: 'number', operator: 'neq', value: 3 },
    ]);
    expect(request.sort.map((rule) => rule.field)).toEqual(['name', 'age']);
  });
});

describe('tableQueryResponse：响应外壳', () => {
  it('items/total 裸载荷，附 meta 时结构完整', () => {
    const item = z.object({ id: z.string() });
    expect(
      tableQueryResponse(item).parse({ items: [{ id: 'a' }], total: 1 }),
    ).toEqual({ items: [{ id: 'a' }], total: 1 });
    const meta = z.object({ totalCalls: z.number() });
    expect(
      tableQueryResponse(item, meta).parse({
        items: [],
        total: 0,
        meta: { totalCalls: 5 },
      }),
    ).toEqual({ items: [], total: 0, meta: { totalCalls: 5 } });
  });
});
