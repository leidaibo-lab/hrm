/** 执行角色键：与 runtime 角色注册表保持同一取值域。 */
export type ExecutorGoal =
  | 'router'
  | 'assess'
  | 'clarify'
  | 'breakdown'
  | 'watchdog';

/** 运行回报类型：与执行回报 kind 一致。 */
export type RuntimeReportKind =
  | 'progress'
  | 'waiting'
  | 'ready'
  | 'blocked'
  | 'failed';

/** 执行预算。 */
export interface ExecutorBudget {
  /** token 上限。 */
  tokens: number;
  /** 超时毫秒。 */
  timeoutMs: number;
}

/** 一次执行所需的上下文与配额。 */
export interface ExecutorRunInput {
  /** 工单主键。 */
  ticketId: string;
  /** 线程主键。 */
  threadId: string;
  /** 执行目标角色。 */
  goal: ExecutorGoal;
  /** 已装配的上下文负载。 */
  context: unknown;
  /** 允许调用的工具标识。 */
  allowedTools: string[];
  /** 预算。 */
  budget: ExecutorBudget;
}

/** 执行结果：运行标识与最终回报。 */
export interface RuntimeReport {
  /** 执行器运行标识；用于回写 Assignment。 */
  executorRunId: string;
  /** 回报类型。 */
  kind: RuntimeReportKind;
  /** 摘要。 */
  summary?: string;
  /** 失败或受阻原因。 */
  error?: string;
}

/** 执行端口：application 只依赖该契约，runtime 实现不反向依赖领域。 */
export interface ExecutorPort {
  /** 运行一次执行；实现方负责快照、恢复与工具调用。 */
  run(input: ExecutorRunInput): Promise<RuntimeReport>;
}

/** 执行端口的 DI 令牌。 */
export const EXECUTOR_PORT = Symbol('EXECUTOR_PORT');
