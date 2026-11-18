import type { TableViewColumn } from '../types';

/** 已提交的列布局信息（由 TableView 组装后传入）。 */
export type RenderColumn<T> = {
  /** 当前参与渲染的业务列定义。 */
  column: TableViewColumn<T>;
  /** 当前列、行或视图项的稳定标识，用于交互关联。 */
  id: string;
  /** 列宽，单位 px。 */
  width: number;
  /** 当前冻结在滚动区域左侧的列状态。 */
  frozen: boolean;
  /** 冻结列的 left 偏移（px）。 */
  frozenOffset: number;
};

/** 表格渲染状态：pending / error / no-result / empty / ready（过渡标记）。 */
export type TableViewStatus =
  | {
      /** 值或状态分支标识，用于约束后续操作和取值。 */ kind: 'pending';
    }
  | {
      /** 值或状态分支标识，用于约束后续操作和取值。 */
      kind: 'error';
      /** 供用户阅读的错误说明。 */
      message: string;
      /** 用户重试时触发的回调。 */
      onRetry: () => void;
    }
  | {
      /** 值或状态分支标识，用于约束后续操作和取值。 */
      kind: 'no-result';
      /** 当前空态或无结果状态展示的内容。 */
      content: React.ReactNode;
    }
  | {
      /** 值或状态分支标识，用于约束后续操作和取值。 */
      kind: 'empty';
      /** 当前空态或无结果状态展示的内容。 */
      content: React.ReactNode;
    }
  | {
      /** 值或状态分支标识，用于约束后续操作和取值。 */
      kind: 'ready';
      /** 是否保留现有数据并展示后台过渡状态。 */
      transition: boolean;
    };

/** 拖拽状态（use-table-drag 透传）。 */
export type DragView = {
  /** 当前拖动列的稳定标识。 */
  sourceId: string;
  /** 拖动列待插入的位置索引。 */
  insertionIndex: number;
  /** 指针在视口中的横坐标；键盘模式为空。 */
  pointerX: number | null;
  /** 交互来源，区分指针和键盘拖动。 */
  mode: 'pointer' | 'keyboard';
} | null;
