import type { HttpFilterCondition, TableQueryRequest } from '@cip/shared';
import { SortDirection } from '@cip/shared';

/**
 * TableView 查询的存储组装层：
 * 规范请求 → 参数化存储条件。字段白名单由 DTO（shared 定义）与 binding 映射双重落实，
 * 本层永不接收 SQL、ORM 查询对象或数据库列名；纯逻辑、无 Nest/Prisma 依赖，
 * 资源 infrastructure 只经模块公开出口消费。
 */

/**
 * 请求字段 → 存储列的绑定映射。列名是服务端常量，客户端永远传展示字段名。
 * boolean：枚举值投影布尔列（如 enabled/disabled）；custom：特殊字段的显式 resolver。
 */
export type TableFieldBinding =
  | {
      /** 标量集合字段的交集筛选。 */ type: 'collection';
      /** 服务端白名单中的集合存储列。 */ column: string;
    }
  | {
      /** 绑定分支标识，用于选择列、布尔映射或自定义解析。 */
      type: 'column';
      /** 服务端列名或当前渲染的列定义，由所属类型限定。 */
      column: string;
      /** 是否按日期时间解释该存储列。 */
      date?: boolean;
      /** 存储列是否允许 null，用于确定排序语义。 */
      nullable?: boolean;
    }
  | {
      /** 绑定分支标识，用于选择列、布尔映射或自定义解析。 */
      type: 'boolean';
      /** 服务端列名或当前渲染的列定义，由所属类型限定。 */
      column: string;
      /** 映射为 true 的枚举值。 */
      truthy: string;
      /** 映射为 false 的枚举值。 */
      falsy: string;
    }
  | {
      /** 绑定分支标识，用于选择列、布尔映射或自定义解析。 */
      type: 'custom';
      /** 允许的筛选操作符或筛选解析配置。 */
      filter?: (
        op: HttpFilterCondition['operator'],
        payload: { value?: string | number; values?: string[] },
      ) => Record<string, unknown>;
      /** 将排序方向转换为存储层排序条件。 */
      order?: (direction: SortDirection) => Record<string, unknown>;
    };

/** PostgreSQL LIKE 模式中的百分号、下划线和反斜线按字面转义。 */
function textCondition(
  value: string,
  negate: boolean,
): Record<string, unknown> {
  const literal = value.replace(/[\\%_]/g, (char) => `\\${char}`);
  const contains = { contains: literal, mode: 'insensitive' as const };
  return negate ? { not: contains } : contains;
}

/** 单个筛选条件 → 存储片段；null 天然不命中正向/负向条件（SQL 三值逻辑）。 */
function filterToCondition(
  filter: HttpFilterCondition,
  binding: TableFieldBinding,
): Record<string, unknown> {
  if (binding.type === 'custom') {
    if (!binding.filter) {
      throw new Error(`字段 ${filter.field} 未声明筛选 resolver`);
    }
    return binding.filter(filter.operator, {
      value: 'value' in filter ? filter.value : undefined,
      values: 'values' in filter ? filter.values : undefined,
    });
  }
  const column = binding.column;
  if (filter.kind === 'text') {
    // 文本操作符统一大小写不敏感；Prisma 嵌套层无 mode，
    // 负向语义用集合级 NOT 包裹（SQL 三值逻辑下 null 行均不命中，语义不变）。
    if (filter.operator === 'eq') {
      return { [column]: { equals: filter.value, mode: 'insensitive' } };
    }
    if (filter.operator === 'neq') {
      return {
        NOT: { [column]: { equals: filter.value, mode: 'insensitive' } },
      };
    }
    if (filter.operator === 'not_contains') {
      return { NOT: { [column]: textCondition(filter.value, false) } };
    }
    return { [column]: textCondition(filter.value, false) };
  }
  if (filter.kind === 'number') {
    return {
      [column]:
        filter.operator === 'neq'
          ? { not: filter.value }
          : { equals: filter.value },
    };
  }
  if (filter.kind === 'enum') {
    if (binding.type === 'collection') {
      const matches = { [column]: { hasSome: filter.values } };
      return filter.operator === 'neq' ? { NOT: matches } : matches;
    }
    if (binding.type === 'boolean') {
      const selected = new Set(
        filter.values.map((value) => {
          if (value !== binding.truthy && value !== binding.falsy)
            throw new Error(`字段 ${filter.field} 的布尔投影值无效`);
          return value === binding.truthy;
        }),
      );
      const matches = [...selected].map((value) => ({
        [column]: { equals: value },
      }));
      return filter.operator === 'neq'
        ? { NOT: { OR: matches } }
        : { OR: matches };
    }
    const mapped = filter.values;
    return {
      [column]: filter.operator === 'neq' ? { notIn: mapped } : { in: mapped },
    };
  }
  // date：before = 截止时刻之前，not_before = 含该时刻。
  const instant = new Date(filter.value);
  return {
    [column]: filter.operator === 'before' ? { lt: instant } : { gte: instant },
  };
}

/**
 * 组合安全 where：权限强制条件（extra，不可被客户端覆盖）+ q 跨字段搜索 + 筛选 AND。
 * qColumns 由资源声明（可含不在筛选白名单内的搜索列）；绑定缺失即 fail-fast。
 */
export function buildTableWhere(
  query: TableQueryRequest,
  bindings: Record<string, TableFieldBinding>,
  extraWhere?: Record<string, unknown> | null,
  qColumns: readonly string[] = [],
): Record<string, unknown> {
  const AND: Record<string, unknown>[] = [];
  if (extraWhere) AND.push(extraWhere);
  if (query.q) {
    AND.push({
      OR: qColumns.map((column) => ({
        [column]: textCondition(query.q as string, false),
      })),
    });
  }
  for (const filter of query.filters) {
    const binding = bindings[filter.field];
    if (!binding) {
      throw new Error(`未声明的查询字段: ${filter.field}`);
    }
    AND.push(filterToCondition(filter, binding));
  }
  return AND.length ? { AND } : {};
}

/** 单个排序规则 → 存储片段。 */
function sortToFragment(
  rule: { field: string; direction: SortDirection },
  binding: TableFieldBinding | undefined,
): Record<string, unknown> {
  if (binding?.type === 'custom') {
    if (!binding.order) {
      throw new Error(`字段 ${rule.field} 未声明排序 resolver`);
    }
    return binding.order(rule.direction);
  }
  const column = binding?.column ?? rule.field;
  return {
    [column]:
      binding?.type === 'column' && binding.nullable
        ? { sort: rule.direction, nulls: 'last' }
        : rule.direction,
  };
}

/** 多列排序 + 稳定唯一 ID tie-break（完整执行多列排序后追加）。 */
export function buildTableOrderBy(
  query: TableQueryRequest,
  bindings: Record<string, TableFieldBinding> = {},
  idColumn = 'id',
): Array<Record<string, unknown>> {
  const orderBy = query.sort.map((rule) => {
    const binding = bindings[rule.field];
    if (!binding && rule.field !== idColumn) {
      throw new Error(`未声明的排序字段: ${rule.field}`);
    }
    return sortToFragment(rule, binding);
  });
  if (!query.sort.some((rule) => rule.field === idColumn)) {
    orderBy.push({ [idColumn]: SortDirection.Asc });
  }
  return orderBy;
}

/** offset 分页参数。 */
export function tablePageArgs(query: TableQueryRequest): {
  skip: number;
  take: number;
} {
  return { skip: (query.page - 1) * query.pageSize, take: query.pageSize };
}
