import { z } from 'zod';

/**
 * TableView 结构化查询的跨端协议。
 * 枚举即 HTTP 取值：API DTO 与 Web 查询状态共同消费，禁止另写字面量。
 * 操作符全局封闭：六种之外不得扩展。
 */

export enum FilterOperator {
  /** 等于；枚举多值时命中任意一个。 */
  Equal = 'eq',
  /** 不等于；枚举多值时全部排除。null 不参与正负匹配。 */
  NotEqual = 'neq',
  /** 文本字面子串（不区分大小写），不解释通配符。 */
  Contains = 'contains',
  NotContains = 'not_contains',
  /** 早于截止时刻（不含）。 */
  Before = 'before',
  /** 不早于截止时刻（含）。 */
  NotBefore = 'not_before',
}

/** HTTP 排序方向；多列排序按数组顺序执行，服务端追加唯一 ID tie-break。 */
export enum SortDirection {
  Asc = 'asc',
  Desc = 'desc',
}

/** ===== Web 交互状态形态（组件 session 存储与列工厂消费）===== */

/** 等于/不等于/包含/不包含四操作符仅适用于文本字段。 */
export type TextFilter = {
  /** 值或状态分支标识，用于约束后续操作和取值。 */
  kind: 'text';
  /** 资源声明的展示字段标识，必须属于服务端白名单。 */
  field: string;
  /** 该字段执行的筛选操作符。 */
  operator:
    | FilterOperator.Equal
    | FilterOperator.NotEqual
    | FilterOperator.Contains
    | FilterOperator.NotContains;
  /** 参与文本匹配的目标内容。 */
  value: string;
};

/** 等于/不等于二操作符适用于数值字段。 */
export type NumberFilter = {
  /** 值或状态分支标识，用于约束后续操作和取值。 */
  kind: 'number';
  /** 资源声明的展示字段标识，必须属于服务端白名单。 */
  field: string;
  /** 该字段执行的筛选操作符。 */
  operator: FilterOperator.Equal | FilterOperator.NotEqual;
  /** 参与数值比较的目标值，允许合法的零。 */
  value: number;
};

/** 等于（任一命中）/不等于（全部排除）二操作符适用于枚举字段。 */
export type EnumFilter = {
  /** 值或状态分支标识，用于约束后续操作和取值。 */
  kind: 'enum';
  /** 资源声明的展示字段标识，必须属于服务端白名单。 */
  field: string;
  /** 该字段执行的筛选操作符。 */
  operator: FilterOperator.Equal | FilterOperator.NotEqual;
  /** 枚举筛选使用的多个目标值。 */
  values: string[];
};

/** Web 状态形态：日期为 Unix 毫秒；HTTP 发送前转 ISO 8601 UTC。 */
export type DateFilter = {
  /** 值或状态分支标识，用于约束后续操作和取值。 */
  kind: 'date';
  /** 资源声明的展示字段标识，必须属于服务端白名单。 */
  field: string;
  /** 该字段执行的筛选操作符。 */
  operator: FilterOperator.Before | FilterOperator.NotBefore;
  /** 截止时间的 Unix 毫秒值。 */
  value: number;
};

/** 四种值形态的筛选条件联合；kind 使每个分支收窄到合法操作符与值形态。 */
export type FilterCondition =
  | TextFilter
  | NumberFilter
  | EnumFilter
  | DateFilter;

/** 单条排序规则：字段为展示字段名，方向为服务端执行顺序。 */
export type SortRule = {
  /** 资源声明的展示字段标识，必须属于服务端白名单。 */
  field: string;
  /** 该字段的升序或降序方向。 */
  direction: SortDirection;
};

/** TableView 有效查询状态（session 存储 schema；筛选草稿不属于有效查询）。 */
export type TableQuery = {
  /** 从 1 开始的页码。 */
  page: number;
  /** 每页返回数量，受资源定义的上限约束。 */
  pageSize: number;
  /** 跨声明搜索字段匹配的文本。 */
  q: string;
  /** 同时生效的字段筛选条件。 */
  filters: FilterCondition[];
  /** 按优先级排列的排序规则。 */
  sort: SortRule[];
};

/** 资源范围：进入请求、查询缓存键与浏览器状态隔离键（身份仍由 API 判定）。 */
export type TableScope = Readonly<
  Record<string, string | number | boolean | null>
>;

/** TableView 查询结果（SDK 响应 { items, total, meta? } 的适配产物）。 */
export type TableData<T, TMeta = unknown> = {
  /** 本次查询或交互对应的行数据集合。 */
  rows: T[];
  /** 满足相同筛选条件的记录总数。 */
  total: number;
  /** 与明细使用相同查询条件的汇总数据。 */
  meta?: TMeta;
};

/** ===== HTTP 规范形态（DTO 校验后的协议形状，API 各层共用）===== */

/** HTTP 日期筛选：ISO 8601 UTC 时刻（秒不得混用）。 */
export type HttpDateFilter = {
  /** 值或状态分支标识，用于约束后续操作和取值。 */
  kind: 'date';
  /** 资源声明的展示字段标识，必须属于服务端白名单。 */
  field: string;
  /** 该字段执行的筛选操作符。 */
  operator: FilterOperator.Before | FilterOperator.NotBefore;
  /** 截止时间的 ISO 8601 UTC 表示。 */
  value: string;
};

/** HTTP 筛选条件联合：日期分支为 ISO 时刻（value 为字符串）。 */
export type HttpFilterCondition =
  | TextFilter
  | NumberFilter
  | EnumFilter
  | HttpDateFilter;

/** POST /query 请求的规范形态：默认排序已落、q 已规整、scope 未声明时为 null。 */
export type TableQueryRequest = {
  /** 从 1 开始的页码。 */
  page: number;
  /** 每页返回数量，受资源定义的上限约束。 */
  pageSize: number;
  /** 跨声明搜索字段匹配的文本。 */
  q: string | null;
  /** 资源查询范围，同时参与缓存与存储隔离。 */
  scope: Record<string, unknown> | null;
  /** 同时生效的字段筛选条件。 */
  filters: HttpFilterCondition[];
  /** 按优先级排列的排序规则。 */
  sort: SortRule[];
};

/** 校验后的请求体形状（controller 解析入参标注用；planTableQuery 消费）。 */
export type TableQueryRequestBody = {
  /** 从 1 开始的页码。 */
  page: number;
  /** 每页返回数量，受资源定义的上限约束。 */
  pageSize: number;
  /** 跨声明搜索字段匹配的文本。 */
  q?: string;
  /** 资源查询范围，同时参与缓存与存储隔离。 */
  scope?: unknown;
  /** 同时生效的字段筛选条件。 */
  filters: Array<
    {
      /** 资源声明的展示字段标识，必须属于服务端白名单。 */
      field: string;
      /** 该字段执行的筛选操作符。 */
      operator: FilterOperator;
    } & Record<string, unknown>
  >;
  /** 按优先级排列的排序规则。 */
  sort: Array<{
    /** 资源声明的展示字段标识，必须属于服务端白名单。 */
    field: string;
    /** 该字段的升序或降序方向。 */
    direction: SortDirection;
  }>;
};

/** 校验后的请求体 → 规范请求：排序为空落默认排序，q 去首尾空白（无 scope 为 null）。 */
export function planTableQuery(
  def: TableQueryDefinition,
  body: TableQueryRequestBody,
): TableQueryRequest {
  const filters: HttpFilterCondition[] = body.filters.map((item) => {
    const kind = def.fields[item.field]?.kind;
    // 操作符合法性已由 buildTableQuerySchema 按字段定义校验，此处按 kind 定型。
    switch (kind) {
      case 'text':
        return {
          kind,
          field: item.field,
          operator: item.operator as TextFilter['operator'],
          value: item.value as string,
        };
      case 'number':
        return {
          kind,
          field: item.field,
          operator: item.operator as NumberFilter['operator'],
          value: item.value as number,
        };
      case 'enum':
        return {
          kind,
          field: item.field,
          operator: item.operator as EnumFilter['operator'],
          values: item.values as string[],
        };
      case 'date':
        return {
          kind,
          field: item.field,
          operator: item.operator as HttpDateFilter['operator'],
          value: item.value as string,
        };
      default:
        throw new Error(`未声明的查询字段: ${item.field}`);
    }
  });
  return {
    page: body.page,
    pageSize: body.pageSize,
    q: body.q?.trim() ? body.q.trim() : null,
    scope: (body.scope as Record<string, unknown> | undefined) ?? null,
    filters,
    sort: body.sort.length
      ? body.sort
      : def.defaultSort.map((rule) => ({ ...rule })),
  };
}

/** ===== 资源查询定义（安全边界声明）===== */

/** 各字段类型允许的操作符子集。 */
export const textOperators = [
  FilterOperator.Equal,
  FilterOperator.NotEqual,
  FilterOperator.Contains,
  FilterOperator.NotContains,
] as const;
/** 数值字段仅允许等于/不等于。 */
export const numberOperators = [
  FilterOperator.Equal,
  FilterOperator.NotEqual,
] as const;
/** 枚举/状态/人员 ID 与 number 共用 eq/neq 子集；多值语义见协议（eq ANY / neq NONE）。 */
export const enumOperators = numberOperators;
/** 日期字段仅允许早于/不早于。 */
export const dateOperators = [
  FilterOperator.Before,
  FilterOperator.NotBefore,
] as const;

/** 查询字段类型：与 FilterKind 一致，HTTP 由定义推断。 */
export type TableFieldKind = 'text' | 'number' | 'enum' | 'date';

/** 字段定义：能力声明即安全边界；filter 未声明即不可筛选。 */
export type TableFieldDef = {
  /** 值或状态分支标识，用于约束后续操作和取值。 */
  kind: TableFieldKind;
  /** 参与 q 跨字段搜索（资源 infra 组 OR 时消费）。 */
  searchable?: boolean;
  /** 是否提供该字段的排序能力。 */
  sortable?: boolean;
  /** 允许的筛选操作符或筛选解析配置。 */
  filter?: readonly FilterOperator[];
  /** enum 值域白名单；缺省开放值域（如按模型 ID 筛选）。 */
  values?: readonly string[];
};

/** 字段定义工厂：以类型限制各 kind 的操作符与值形态。 */
export const field = {
  text: (
    opts: {
      searchable?: boolean;
      sortable?: boolean;
      filter?: readonly (typeof textOperators)[number][];
    } = {},
  ): TableFieldDef => ({ kind: 'text', ...opts }),
  number: (
    opts: {
      sortable?: boolean;
      filter?: readonly (typeof numberOperators)[number][];
    } = {},
  ): TableFieldDef => ({ kind: 'number', ...opts }),
  /** 第一参数为值域白名单；传 null 表示开放值域。 */
  enum: (
    values: readonly string[] | null,
    opts: {
      sortable?: boolean;
      filter?: readonly (typeof enumOperators)[number][];
    } = {},
  ): TableFieldDef => ({
    kind: 'enum',
    ...(values ? { values } : {}),
    ...opts,
  }),
  date: (
    opts: {
      sortable?: boolean;
      filter?: readonly (typeof dateOperators)[number][];
    } = {},
  ): TableFieldDef => ({ kind: 'date', ...opts }),
};

/** 资源查询定义：字段白名单、默认排序与上限的唯一声明处。 */
export type TableQueryDefinition<FIELDS extends string = string> = {
  /** 资源允许查询的字段及其能力白名单。 */
  fields: Record<FIELDS, TableFieldDef>;
  /** 用户未指定排序时采用的稳定排序规则。 */
  defaultSort: ReadonlyArray<{
    /** 资源声明的展示字段标识，必须属于服务端白名单。 */
    field: FIELDS;
    /** 该字段的升序或降序方向。 */
    direction: SortDirection;
  }>;
  /** 请求允许的每页最大记录数。 */
  maxPageSize: number;
  /** 请求允许的排序规则数量上限。 */
  maxSortRules: number;
  /** 搜索文本允许的最大字符数。 */
  maxQLength: number;
};

/** 收敛定义声明：缺省上限为 pageSize 100 / 排序 5 条 / q 64 字符、无默认排序。 */
export function defineTableQuery<
  FIELDS extends Record<string, TableFieldDef>,
>(def: {
  fields: FIELDS;
  defaultSort?: ReadonlyArray<{
    field: keyof FIELDS & string;
    direction: SortDirection;
  }>;
  maxPageSize?: number;
  maxSortRules?: number;
  maxQLength?: number;
}): TableQueryDefinition<keyof FIELDS & string> {
  const allowed = {
    text: textOperators,
    number: numberOperators,
    enum: enumOperators,
    date: dateOperators,
  };
  for (const [name, definition] of Object.entries(def.fields)) {
    if (
      definition.filter?.some(
        (operator) =>
          !(allowed[definition.kind] as readonly FilterOperator[]).includes(
            operator,
          ),
      )
    ) {
      throw new Error(`字段 ${name} 的操作符与类型不匹配`);
    }
  }
  return {
    fields: def.fields,
    defaultSort: def.defaultSort ?? [],
    maxPageSize: def.maxPageSize ?? 100,
    maxSortRules: def.maxSortRules ?? 5,
    maxQLength: def.maxQLength ?? 64,
  };
}

/** HTTP 排序方向取值（与枚举一致，zod 层直接用字面量保持 OpenAPI 内联）。 */
const sortDirectionSchema = z.enum([SortDirection.Asc, SortDirection.Desc]);

/**
 * z.union 签名要求非空元组：资源未声明可筛字段时以 never 占位（该 union 拒绝一切输入），
 * 仅声明一个可筛字段时复用同型 schema 补齐元组形状，运行时语义不变。
 */
function toUnionTuple(
  schemas: z.ZodType[],
): [z.ZodType, z.ZodType, ...z.ZodType[]] {
  if (schemas.length === 0) return [z.never(), z.never()];
  const [head, second, ...rest] = schemas;
  return [head ?? z.never(), second ?? head ?? z.never(), ...rest];
}

/**
 * 由定义构建该资源自己的 POST /query 请求 schema。
 * 白名单外字段、同字段重复条件、kind 不允许的操作符、值形态不符
 * 与重复排序字段一律 400（contracts.md 路由与查询 4）。
 * scope 由资源传入（明确 keys，不接受任意 object）；普通资源可省略。
 */
export function buildTableQuerySchema<FIELDS extends string>(
  def: TableQueryDefinition<FIELDS>,
  options: { scope?: z.ZodType } = {},
): z.ZodType {
  // 泛型 mapped type 无字符串索引签名，Object.entries 需显式恢复值类型。
  const fieldEntries = Object.entries(def.fields) as [string, TableFieldDef][];
  const filterByField = fieldEntries
    .filter(([, fieldDef]) => (fieldDef.filter?.length ?? 0) > 0)
    .map(([name, fieldDef]) => {
      const base = {
        field: z.literal(name),
        operator: z.enum([...new Set(fieldDef.filter ?? [])] as [
          FilterOperator,
          ...FilterOperator[],
        ]),
      };
      switch (fieldDef.kind) {
        case 'text':
          return z.strictObject({ ...base, value: z.string().min(1).max(512) });
        case 'number':
          return z.strictObject({ ...base, value: z.number().finite() });
        case 'enum':
          return z.strictObject({
            ...base,
            values: fieldDef.values
              ? z
                  .array(z.enum([...fieldDef.values] as [string, ...string[]]))
                  .min(1)
                  .max(100)
              : z.array(z.string().min(1).max(128)).min(1).max(100),
          });
        case 'date':
          return z.strictObject({ ...base, value: z.iso.datetime() });
        default:
          throw new Error(`未知的字段类型: ${fieldDef.kind as string}`);
      }
    });
  const sortableFields = fieldEntries
    .filter(([, fieldDef]) => fieldDef.sortable === true)
    .map(([name]) => name);
  return z.strictObject({
    page: z.number().int().min(1).max(1_000_000).default(1),
    pageSize: z.number().int().min(1).max(def.maxPageSize).default(20),
    q: z.string().trim().max(def.maxQLength).optional(),
    // scope 由资源声明（明确 keys）；未声明时资源无 scope 字段。
    scope: options.scope
      ? options.scope.optional()
      : z.strictObject({}).optional(),
    filters: z
      .array(z.union(toUnionTuple(filterByField)))
      .max(fieldEntries.length)
      .refine(
        (items) =>
          new Set((items as Array<{ field: string }>).map((item) => item.field))
            .size === (items as unknown[]).length,
        { error: '同一字段最多一条筛选条件' },
      )
      .default([]),
    sort: z
      .array(
        z.object({
          field: z.enum(sortableFields as [FIELDS, ...FIELDS[]]),
          direction: sortDirectionSchema,
        }),
      )
      .max(def.maxSortRules)
      .refine(
        (items) =>
          new Set(items.map((item) => item.field)).size === items.length,
        { error: '排序字段不允许重复' },
      )
      .default([]),
  });
}

/** TableView offset 响应外壳：{ items, total } 或附 meta（相同筛选条件的汇总）。 */
export function tableQueryResponse<T extends z.ZodType, M extends z.ZodType>(
  items: T,
  meta?: M,
): z.ZodType {
  return z.object({
    items: z.array(items),
    total: z.number().int(),
    ...(meta ? { meta } : {}),
  });
}
