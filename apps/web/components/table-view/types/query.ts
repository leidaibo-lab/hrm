import type { TableQuery, TableScope } from '@cip/shared';

/** TableView 查询与动作的公共类型：协议类型唯一来源在 @cip/shared。 */
export type {
  DateFilter,
  EnumFilter,
  FilterCondition,
  FilterOperator,
  HttpFilterCondition,
  NumberFilter,
  SortRule,
  TableData,
  TableQuery,
  TableScope,
  TextFilter,
} from '@cip/shared';

/** Web 编辑器值分类；HTTP 根据字段定义确定类型，不传 kind。 */
export enum FilterKind {
  Text = 'text',
  Number = 'number',
  Enum = 'enum',
  Date = 'date',
}

/** 查询执行上下文：signal 用于取消旧请求，scope 由 TableView 管理。 */
export type TableQueryContext = {
  /** 查询取消信号，必须传递给底层网络请求。 */
  signal: AbortSignal;
  /** 资源查询范围，同时参与缓存与存储隔离。 */
  scope: TableScope;
};

/** TableView 的取数函数：业务经 createTableQuery 创建，也可自行实现。 */
export type TableQueryFn<T, TMeta = unknown> = (
  query: TableQuery,
  context: TableQueryContext,
) => Promise<import('@cip/shared').TableData<T, TMeta>>;

/** 结构化错误形态：保留机器判断所需的 code/status/traceId，不退化为纯文案。 */
export type TableError = {
  /** 供用户阅读的错误说明。 */
  message: string;
  /** 业务标识，用于目录匹配或错误识别。 */
  code?: string;
  /** HTTP 响应状态，用于错误分类与重试判断。 */
  status?: number;
  /** 关联请求链路的标识。 */
  traceId?: string;
  /** 字段级校验或其他结构化错误明细。 */
  errors?: readonly unknown[];
};

/** 批量动作的结构化部分结果：成功项取消选中，失败项保留并呈现错误。 */
export type BulkResult = {
  /** 本次批量操作明确成功的目标标识。 */
  succeededIds: string[];
  /** 未成功的目标及其对应结构化错误。 */
  failed: Array<{
    /** 当前列、行或视图项的稳定标识，用于交互关联。 */
    id: string;
    /** 结构化失败信息；保留机器判断所需字段。 */
    error: TableError;
  }>;
};

/** 有效查询变化的原因，区分用户交互、范围切换与页码修正。 */
export type QueryChangeReason =
  | 'search'
  | 'filter'
  | 'sort'
  | 'page'
  | 'pageSize'
  | 'reset'
  | 'scope'
  | 'pageCorrection';
/** 选择变化原因枚举。 */
export type SelectionReason =
  | 'row'
  | 'all'
  | 'clear'
  | 'query'
  | 'scope'
  | 'data'
  | 'action';
/** 列状态变化原因枚举。 */
export type ColumnStateReason =
  | 'reorder'
  | 'resize'
  | 'visibility'
  | 'freeze'
  | 'reset';

/** 排序方向的运行时取值引用（组件内默认排序使用）。 */
export { SortDirection } from '@cip/shared';
