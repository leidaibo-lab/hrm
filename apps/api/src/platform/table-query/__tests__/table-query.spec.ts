import type { TableQueryRequest } from '@cip/shared';
import { FilterOperator, SortDirection } from '@cip/shared';
import { describe, expect, it } from 'vitest';
import {
  buildTableOrderBy,
  buildTableWhere,
  tablePageArgs,
} from '../table-query.service';

const query = (
  overrides: Partial<TableQueryRequest> = {},
): TableQueryRequest => ({
  page: 1,
  pageSize: 20,
  q: null,
  scope: null,
  filters: [],
  sort: [],
  ...overrides,
});

describe('buildTableWhere：安全条件组装', () => {
  const bindings = {
    name: { type: 'column', column: 'name' } as const,
    status: {
      type: 'boolean',
      column: 'enabled',
      truthy: 'active',
      falsy: 'suspended',
    } as const,
  };

  it('文本 contains 为字面子串且大小写不敏感，不解释通配符', () => {
    const where = buildTableWhere(
      query({
        filters: [
          {
            kind: 'text',
            field: 'name',
            operator: FilterOperator.Contains,
            value: '张_a%',
          },
        ],
      }),
      bindings,
    );
    expect(where).toEqual({
      AND: [{ name: { contains: '张\\_a\\%', mode: 'insensitive' } }],
    });
  });

  it('负向条件用 not 包裹且 enum 值域投影布尔列', () => {
    const where = buildTableWhere(
      query({
        filters: [
          {
            kind: 'enum',
            field: 'status',
            operator: FilterOperator.NotEqual,
            values: ['active'],
          },
          {
            kind: 'text',
            field: 'name',
            operator: FilterOperator.NotEqual,
            value: 'x',
          },
        ],
      }),
      bindings,
    );
    expect(where).toEqual({
      AND: [
        { NOT: { OR: [{ enabled: { equals: true } }] } },
        { NOT: { name: { equals: 'x', mode: 'insensitive' } } },
      ],
    });
  });

  it('负向 contains 用集合级 NOT 包裹（Prisma 嵌套层无 mode）', () => {
    const where = buildTableWhere(
      query({
        filters: [
          {
            kind: 'text',
            field: 'name',
            operator: FilterOperator.NotContains,
            value: 'x',
          },
        ],
      }),
      bindings,
    );
    expect(where).toEqual({
      AND: [{ NOT: { name: { contains: 'x', mode: 'insensitive' } } }],
    });
  });

  it('date 语义：早于为 lt，不早于为 gte（含截止时刻）', () => {
    const where = buildTableWhere(
      query({
        filters: [
          {
            kind: 'date',
            field: 'createdAt',
            operator: FilterOperator.NotBefore,
            value: '2026-10-31T16:00:00.000Z',
          },
        ],
      }),
      { createdAt: { type: 'column', column: 'createdAt', date: true } },
    );
    expect(where).toEqual({
      AND: [{ createdAt: { gte: new Date('2026-10-31T16:00:00.000Z') } }],
    });
  });

  it('权限强制条件放最外层，q 搜索跨声明列 OR', () => {
    const where = buildTableWhere(
      query({ q: '张' }),
      bindings,
      { tenantId: 't1' },
      ['name', 'nickname'],
    );
    expect(where).toEqual({
      AND: [
        { tenantId: 't1' },
        {
          OR: [
            { name: { contains: '张', mode: 'insensitive' } },
            { nickname: { contains: '张', mode: 'insensitive' } },
          ],
        },
      ],
    });
  });

  it('custom 字段走显式 resolver', () => {
    const where = buildTableWhere(
      query({
        filters: [
          {
            kind: 'enum',
            field: 'badge',
            operator: FilterOperator.Equal,
            values: ['active'],
          },
        ],
      }),
      {
        badge: {
          type: 'custom',
          filter: (_op, { values }) => ({ badge: { in: values } }),
        },
      },
    );
    expect(where).toEqual({ AND: [{ badge: { in: ['active'] } }] });
  });

  it('绑定缺失即 fail-fast，不按客户端字段名直查', () => {
    expect(() =>
      buildTableWhere(
        query({
          filters: [
            {
              kind: 'text',
              field: 'passwordHash',
              operator: FilterOperator.Equal,
              value: 'x',
            },
          ],
        }),
        bindings,
      ),
    ).toThrow('未声明的查询字段: passwordHash');
  });

  it('无 extra/q/filters 时返回空条件', () => {
    expect(buildTableWhere(query(), bindings)).toEqual({});
  });
});

describe('buildTableOrderBy：多列排序与稳定 tie-break', () => {
  it('按声明顺序执行多列排序，末尾追加唯一 ID 升序', () => {
    const orderBy = buildTableOrderBy(
      query({
        sort: [
          { field: 'createdAt', direction: SortDirection.Desc },
          { field: 'name', direction: SortDirection.Asc },
        ],
      }),
      {
        createdAt: { type: 'column', column: 'createdAt' },
        name: { type: 'column', column: 'name' },
      },
    );
    expect(orderBy).toEqual([
      { createdAt: 'desc' },
      { name: 'asc' },
      { id: 'asc' },
    ]);
  });

  it('排序已含 id 时不重复追加；custom 排序走 resolver', () => {
    const orderBy = buildTableOrderBy(
      query({
        sort: [
          { field: 'relevance', direction: SortDirection.Asc },
          { field: 'id', direction: SortDirection.Desc },
        ],
      }),
      {
        relevance: {
          type: 'custom',
          order: (direction) => ({ _relevance: direction }),
        },
      },
    );
    expect(orderBy).toEqual([{ _relevance: 'asc' }, { id: 'desc' }]);
  });

  it('空排序时默认排序仍带 ID tie-break', () => {
    expect(
      buildTableOrderBy(
        query({
          sort: [{ field: 'createdAt', direction: SortDirection.Desc }],
        }),
        { createdAt: { type: 'column', column: 'createdAt' } },
      ),
    ).toEqual([{ createdAt: 'desc' }, { id: 'asc' }]);
  });

  it('未声明 binding 的排序字段 fail-fast', () => {
    expect(() =>
      buildTableOrderBy(
        query({ sort: [{ field: 'secret', direction: SortDirection.Asc }] }),
        {},
      ),
    ).toThrow('未声明的排序字段: secret');
  });
});

describe('tablePageArgs：offset 分页', () => {
  it('按页换算 skip/take', () => {
    expect(tablePageArgs(query({ page: 3, pageSize: 20 }))).toEqual({
      skip: 40,
      take: 20,
    });
  });
});
