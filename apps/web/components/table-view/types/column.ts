import type { FilterCondition, FilterOperator } from '@cip/shared';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** 语义选项色调：渲染层根据 tone 适配状态点/chip/筛选样式，业务不传 CSS 类。 */
export type OptionTone = 'success' | 'neutral' | 'warning' | 'danger';

/** option factory 的产物：label/tone/icon 三元组。 */
export type SemanticOption = {
  /** 展示给用户的动作或选项名称。 */
  label: string;
  /** 选项的语义色调，由设计令牌决定实际样式。 */
  tone: OptionTone;
  /** 展示图标；省略时由所在组件决定是否使用默认图标。 */
  icon?: LucideIcon;
};

/** 枚举列的选项映射：key 即提交给后端的值。 */
export type ColumnOptionMap = Record<string, SemanticOption>;

/**
 * 列筛选能力声明：kind 由列工厂按工厂类型注入，业务不传 kind；
 * operators 是该字段允许的操作符子集（六种封闭枚举的子集）。
 */
export type ColumnFilterDef = {
  /** 值或状态分支标识，用于约束后续操作和取值。 */
  kind: FilterCondition['kind'];
  /** 该字段允许使用的筛选操作符。 */
  operators: readonly FilterOperator[];
  /** enum 多选（eq 任一命中 / neq 全部排除）。 */
  multiple?: boolean;
  /** date 粒度：day 以所选日在 timeZone 的零点为截止时刻。 */
  granularity?: 'day' | 'datetime';
  /** date 的 IANA 时区（不能用宿主本地时区隐式解释）。 */
  timeZone?: string;
  /** enum 选项清单（工厂注入，驱动筛选选择器）。 */
  options?: ReadonlyArray<{
    /** 提交或比较使用的字段值。 */
    value: string;
    /** 展示给用户的动作或选项名称。 */
    label: string;
  }>;
};

/**
 * 截断策略：`true` 单行省略（CSS，随列宽生效）；`false` 换行；
 * `number` = line-clamp 行数；`{ middle: n }` = JS 首尾各 n 字符。
 */
export type Truncate =
  | boolean
  | number
  | {
      /** 中段截断时首尾各保留的字符数。 */ middle: number;
    };

/**
 * 列定义：渲染、筛选、排序与列设置的全部能力。
 * 优先用 createColumns 工厂构造；手写列只需 id/header/cell。
 */
export type TableViewColumn<T> = {
  /** 稳定列 id：不随显示文案变化；派生字段可自定义但必须有 accessor。 */
  id: string;
  /** 列标题，用于表头和设置面板展示。 */
  header: string;
  /** 展示图标；省略时由所在组件决定是否使用默认图标。 */
  icon?: LucideIcon;
  /** 单元格内容的水平对齐方向。 */
  align?: 'left' | 'right';
  /** 列宽，单位 px。 */
  width?: number;
  /** 列允许的最小宽度，单位 px。 */
  minWidth?: number;
  /** 列允许的最大宽度，单位 px。 */
  maxWidth?: number;
  /** 主语义列：窄屏卡片标题；默认不可隐藏。 */
  primary?: boolean;
  /** 次要列：1024–1279（icon rail 档）强制隐藏。 */
  secondary?: boolean;
  /** 是否提供该字段的排序能力。 */
  sortable?: boolean;
  /** 工厂提供的值类型，用于排序方向文案，不授权筛选能力。 */
  valueKind?: FilterCondition['kind'];
  /** 未声明即不可筛选；toolbar.filterable 只是总开关。 */
  filter?: ColumnFilterDef;
  /** 是否允许用户拖拽调整列宽。 */
  resizable?: boolean;
  /** 是否允许用户隐藏该列。 */
  hideable?: boolean;
  /** 是否允许将该列冻结在滚动区域左侧。 */
  freezable?: boolean;
  /** 是否允许用户调整该列位置。 */
  reorderable?: boolean;
  /** 排序/展示取值，默认 `row[id]`；派生列必传。 */
  accessor?: (row: T) => unknown;
  /** 自定义单元格渲染；缺省渲染 accessor 文本（空值显示 —）。 */
  cell?: (row: T) => ReactNode;
};

/** 列状态（localStorage 持久化）：order/widths/hidden/frozen 四组。 */
export type ColumnState = {
  /** 按界面顺序排列的列标识。 */
  order: string[];
  /** 按稳定列标识保存的宽度，单位 px。 */
  widths: Record<string, number>;
  /** 当前被用户隐藏的列标识。 */
  hidden: string[];
  /** 当前冻结在滚动区域左侧的列状态。 */
  frozen: string[];
};
