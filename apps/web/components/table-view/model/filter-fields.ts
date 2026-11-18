import type { FilterCondition, TableViewColumn } from '../types';

/** 显式授权的筛选字段，不包括没有声明 filter 的列。 */
export type FilterableField = {
  /** 当前列、行或视图项的稳定标识，用于交互关联。 */
  id: string;
  /** 列标题，用于表头和设置面板展示。 */
  header: string;
  /** 展示图标；省略时由所在组件决定是否使用默认图标。 */
  icon?: TableViewColumn<never>['icon'];
  /** 值或状态分支标识，用于约束后续操作和取值。 */
  kind: FilterCondition['kind'];
  /** 该字段允许使用的筛选操作符。 */
  operators: readonly FilterCondition['operator'][];
  /** 是否允许一次选择多个枚举值。 */
  multiple?: boolean;
  /** 日期筛选粒度，区分自然日和精确时刻。 */
  granularity?: 'day' | 'datetime';
  /** 解释日期边界所使用的 IANA 时区。 */
  timeZone?: string;
  /** 可选择的枚举值及其展示名称。 */
  options?: ReadonlyArray<{
    /** 提交或比较使用的字段值。 */
    value: string;
    /** 展示给用户的动作或选项名称。 */
    label: string;
  }>;
};

/** 从列定义提取允许的输入能力。 */
export function filterableFields<T>(
  columns: TableViewColumn<T>[],
): FilterableField[] {
  return columns.flatMap((column) =>
    column.filter
      ? [
          {
            id: column.id,
            header: column.header,
            icon: column.icon,
            ...column.filter,
          },
        ]
      : [],
  );
}

/** 封闭的六种筛选文案。 */
export const OPERATOR_LABEL: Record<string, string> = {
  eq: '等于',
  neq: '不等于',
  contains: '包含',
  not_contains: '不包含',
  before: '早于',
  not_before: '不早于',
};

/** chip 显示业务选项文案和字段时区下的日期。 */
export function filterSummary(
  filter: FilterCondition,
  field?: FilterableField,
): string {
  let value: string;
  if (filter.kind === 'enum')
    value = filter.values
      .map(
        (item) =>
          field?.options?.find((option) => option.value === item)?.label ??
          item,
      )
      .join('、');
  else if (filter.kind === 'date')
    value = new Intl.DateTimeFormat('zh-CN', {
      timeZone: field?.timeZone ?? 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(filter.value));
  else value = String(filter.value);
  return `${OPERATOR_LABEL[filter.operator]} ${value}`;
}
