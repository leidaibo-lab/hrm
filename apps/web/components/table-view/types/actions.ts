import type { TableData, TableQuery, TableScope } from '@cip/shared';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import type { ColumnState, TableViewColumn } from './column';
import type {
  BulkResult,
  ColumnStateReason,
  QueryChangeReason,
  SelectionReason,
  TableError,
  TableQueryFn,
} from './query';

export type { ColumnState, TableViewColumn } from './column';
export type {
  ColumnStateReason,
  QueryChangeReason,
  SelectionReason,
} from './query';

/** 动作确认配置：字符串视为标题。 */
export type ActionConfirm =
  | string
  | {
      /** 界面标题；未提供时由所在组件使用默认标题。 */
      title?: string;
      /** 供界面展示的补充说明。 */
      description?: string;
      /** 确认按钮的展示文案。 */
      confirmLabel?: string;
      /** 取消按钮的展示文案。 */
      cancelLabel?: string;
    };

/** 视图动作上下文：当前查询与查询控制句柄。 */
export type QueryControl = {
  /** 有效查询条件或取数适配器，由所属类型限定。 */
  query: TableQuery;
  /** 重新获取当前查询的数据并返回完成状态。 */
  refresh: () => Promise<void>;
  /** 恢复初始查询条件并回到第一页。 */
  resetQuery: () => void;
};

/**
 * 视图栏自定义动作（toolbar.actions）：第一项为主按钮，其余进下拉；
 * 不绑定「新建」语义；权限过滤由业务先完成。
 */
export type ViewAction = {
  /** 展示给用户的动作或选项名称。 */
  label: string;
  /** 展示图标；省略时由所在组件决定是否使用默认图标。 */
  icon?: LucideIcon;
  /** 是否以危险操作样式提示用户。 */
  danger?: boolean;
  /** 能力是否可用，由调用方按当前上下文判定。 */
  enabled?: (context: QueryControl) => boolean;
  /** 执行前的确认配置；省略时直接执行。 */
  confirm?: ActionConfirm;
  /** 返回 BulkResult 时组件按结构化部分结果反馈（视图动作一般不返回）。 */
  onRun: (context: QueryControl) => unknown;
};

/**
 * 行操作（actions）：前两个直接文本动作，其余进更多菜单；
 * `when` 返回 false 隐藏业务不适用项；权限过滤由业务先完成。
 */
export type RowAction<T> = {
  /** 展示给用户的动作或选项名称。 */
  label: string;
  /** 展示图标；省略时由所在组件决定是否使用默认图标。 */
  icon?: LucideIcon;
  /** 是否以危险操作样式提示用户。 */
  danger?: boolean;
  /** 判断该动作是否适用于当前行，返回 false 时隐藏。 */
  when?: (row: T) => boolean;
  /** 能力是否可用，由调用方按当前上下文判定。 */
  enabled?: (row: T) => boolean;
  /** 执行前的确认配置；省略时直接执行。 */
  confirm?: ActionConfirm;
  /** 执行当前动作，返回值与异步失败由动作管理器处理。 */
  onRun: (row: T) => unknown;
};

/**
 * 批量动作（selection.actions）：收到动作开始时捕获的当前页选中 rows（只读快照，
 * 数组变化不改变已开始动作的目标）。
 */
export type BulkAction<T> = {
  /** 展示给用户的动作或选项名称。 */
  label: string;
  /** 展示图标；省略时由所在组件决定是否使用默认图标。 */
  icon?: LucideIcon;
  /** 是否以危险操作样式提示用户。 */
  danger?: boolean;
  /** 能力是否可用，由调用方按当前上下文判定。 */
  enabled?: (rows: readonly T[]) => boolean;
  /** 执行前的确认配置；省略时直接执行。 */
  confirm?: ActionConfirm;
  /** 成功后保留或清空选择的策略。 */
  selectionAfterRun?: 'keep' | 'clear';
  /** 执行当前动作，返回值与异步失败由动作管理器处理；无返回即 undefined（TS 5.1 隐式返回规则）。 */
  onRun: (
    rows: readonly T[],
  ) => BulkResult | undefined | Promise<BulkResult | undefined>;
};

/** 查询状态变化事件：只在有效状态变化时触发（初次恢复不算用户变化）。 */
export type QueryChangeEvent = {
  /** 本次变化前的完整状态。 */
  previous: TableQuery;
  /** 本次变化后的完整状态。 */
  next: TableQuery;
  /** 触发状态变化的原因，用于区分交互和恢复。 */
  reason: QueryChangeReason;
};

/** 选择变化事件：ids 与 rows 始终对应当前页数据。 */
export type SelectionChangeEvent<T> = {
  /** 与事件行数据对应的稳定标识集合。 */
  ids: string[];
  /** 本次查询或交互对应的行数据集合。 */
  rows: T[];
  /** 触发状态变化的原因，用于区分交互和恢复。 */
  reason: SelectionReason;
};

/** 列状态变化事件：previous/next 为完整列状态。 */
export type ColumnStateChangeEvent = {
  /** 本次变化前的完整状态。 */
  previous: ColumnState;
  /** 本次变化后的完整状态。 */
  next: ColumnState;
  /** 触发状态变化的原因，用于区分交互和恢复。 */
  reason: ColumnStateReason;
};

/** 加载成功事件：只对当前网络请求实际成功触发，cache hit 不触发。 */
export type LoadSuccessEvent<T, TMeta> = {
  /** 本次成功获取的数据及汇总信息。 */
  data: TableData<T, TMeta>;
  /** 有效查询条件或取数适配器，由所属类型限定。 */
  query: TableQuery;
};

/** 加载失败事件：只在最终失败触发（取消与重试中间态不算）。 */
export type LoadErrorEvent = {
  /** 结构化失败信息；保留机器判断所需字段。 */
  error: TableError;
  /** 有效查询条件或取数适配器，由所属类型限定。 */
  query: TableQuery;
};

/** 动作事件：label 标识动作实例（动作无必需业务 id）。 */
export type ActionEvent = {
  /** 展示给用户的动作或选项名称。 */ label: string;
  /** 动作所在的交互区域。 */ scope: 'view' | 'row' | 'bulk';
  /** 执行开始时捕获的目标，空数组表示整个视图动作。 */ rowIds: readonly string[];
  /** 动作描述，供订阅者观察而不暴露重复执行入口。 */ action: {
    /** 动作发生时展示给用户的名称。 */
    label: string;
    /** 动作是否被标记为危险操作。 */
    danger?: boolean;
  };
  /** 成功动作的返回结果，批量操作可含部分失败。 */ result?: unknown;
};
/** 动作失败事件：携带结构化错误。 */
export type ActionErrorEvent = ActionEvent & {
  /** 结构化失败信息；保留机器判断所需字段。 */
  error: TableError;
};

/** toolbar 是视图栏操作的唯一配置入口；未开启的能力不渲染入口。 */
export type ToolbarConfig = {
  /** 是否开启搜索，以及可选的输入与防抖配置。 */
  searchable?:
    | boolean
    | {
        /** 搜索输入为空时的提示文案。 */
        placeholder?: string;
        /** 输入停止后发起搜索的等待时长，单位毫秒。 */
        debounceMs?: number;
      };
  /** 是否开放筛选入口。 */
  filterable?: boolean;
  /** 是否提供该字段的排序能力。 */
  sortable?:
    | boolean
    | {
        /** 允许同时生效的排序规则上限。 */ maxRules?: number;
      };
  /** 是否开放列设置入口。 */
  columnSettings?: boolean;
  /** 当前上下文可用的动作配置。 */
  actions?: ViewAction[];
};

/** 数据表格的公共配置与事件契约。 */
export type TableViewProps<T, TMeta = unknown> = {
  /** 表格 id：query cache key、存储键与 mutation 失效前缀的一部分。 */
  id: string;
  /** 身份分区键：隔离同一账号不同用户在本机的表格状态（非授权凭证）。 */
  identityKey: string;
  /** 界面标题；未提供时由所在组件使用默认标题。 */
  title?: string;
  /** 资源查询范围，同时参与缓存与存储隔离。 */
  scope?: TableScope;
  /** 从服务端取得当前查询结果的适配器，必须处理取消信号。 */
  query: TableQueryFn<T, TMeta>;
  /** 表格的列定义与能力声明。 */
  columns: TableViewColumn<T>[];
  /** 提取行的稳定主键，供选择和渲染复用。 */
  rowKey: (row: T) => string;
  /** 视图栏入口和动作配置。 */
  toolbar?: ToolbarConfig;
  /** 当前上下文可用的动作配置。 */
  actions?: RowAction<T>[];
  /** 当前页选择与批量动作配置。 */
  selection?: {
    /** 能力是否可用，由调用方按当前上下文判定。 */
    enabled: boolean;
    /** 当前上下文可用的动作配置。 */
    actions?: BulkAction<T>[];
  };
  /** 初始化查询时合并的默认条件。 */
  defaultQuery?: Partial<TableQuery>;
  /** 高度、分页底栏与操作列固定配置。 */
  layout?: {
    /** 数据区最大高度；'available' 表示视口剩余空间。 */
    maxHeight?: number | 'available';
    /** 分页底栏模式：sticky（默认）或 flow。 */
    footerMode?: 'sticky' | 'flow';
    /** 操作列是否右侧 sticky（默认 false）。 */
    pinActions?: boolean;
  };
  /** 没有业务记录时的展示内容与动作。 */
  empty?: {
    /** 展示图标；省略时由所在组件决定是否使用默认图标。 */
    icon?: LucideIcon;
    /** 界面标题；未提供时由所在组件使用默认标题。 */
    title?: string;
    /** 供界面展示的补充说明。 */
    description?: string;
    /** 空态提供的业务操作入口。 */
    action?: ViewAction;
  };
  /** 报表汇总：渲染同一 query cache 中的 meta，不在回调里复制到组件 state。 */
  renderMeta?: (
    meta: TMeta | undefined,
    state: { fetching: boolean; stale: boolean },
  ) => ReactNode;
  /** 渲染指定行的详情内容，并提供关闭能力。 */
  renderRowDetail?: (context: { row: T; close: () => void }) => ReactNode;
  /** 有效查询变化后触发，携带前后状态与原因。 */
  onQueryChange?: (event: QueryChangeEvent) => void;
  /** 当前页选择变化后触发，携带对应行数据。 */
  onSelectionChange?: (event: SelectionChangeEvent<T>) => void;
  /** 列状态变化后触发，携带完整前后状态。 */
  onColumnStateChange?: (event: ColumnStateChangeEvent) => void;
  /** 网络请求最终成功时触发；缓存命中不触发。 */
  onLoadSuccess?: (event: LoadSuccessEvent<T, TMeta>) => void;
  /** 网络请求最终失败时触发；中间重试不触发。 */
  onLoadError?: (event: LoadErrorEvent) => void;
  /** 动作开始时触发，携带动作标识。 */
  onActionStart?: (event: ActionEvent) => void;
  /** 动作完成且未报告失败时触发。 */
  onActionSuccess?: (event: ActionEvent) => void;
  /** 动作失败时触发，携带结构化错误。 */
  onActionError?: (event: ActionErrorEvent) => void;
  /** 点击行主体时触发；未提供时不附加行点击行为。 */
  onRowClick?: (row: T) => void;
};

/** TableView imperative 句柄（ref 提供的辅助能力，不复制受控 props API）。 */
export type TableViewHandle = {
  /** 重新获取当前查询的数据并返回完成状态。 */
  refresh: () => Promise<void>;
  /** 恢复初始查询条件并回到第一页。 */
  resetQuery: () => void;
  /** 清空当前页选择。 */
  clearSelection: () => void;
  /** 恢复列的初始顺序、宽度和可见状态。 */
  resetColumns: () => void;
  /** 读取当前生效的完整查询条件。 */
  getQuery: () => TableQuery;
};
