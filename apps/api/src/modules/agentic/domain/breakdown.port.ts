import type { Policy } from './policy.entity';
import type { ToolCallTrace } from './tool-trace.entity';
import type { Trigger } from './trigger.entity';

/** 拆解端口的 DI 令牌。 */
export const BREAKDOWN_PORT = Symbol('BREAKDOWN_PORT');

/** 拆解任务项。 */
export interface BreakdownTask {
  /** 任务标题。 */
  title: string;
  /** 任务说明；信息不足时为 null。 */
  description: string | null;
  /** 依赖任务序号（从 0 开始）；无依赖为 null。 */
  dependsOn: number[] | null;
  /** 建议负责人；无法判断时为 null。 */
  owner: string | null;
}

/** 拆解输入：工单、事件批次与当前策略。 */
export interface BreakdownInput {
  /** 所属工单主键。 */
  ticketId: string;
  /** 所属线程主键。 */
  threadId: string;
  /** 上下文事件批次。 */
  triggers: Trigger[];
  /** 当前策略。 */
  policy: Policy;
  /** 已确认的澄清稿；缺失时按仅工单上下文拆解。 */
  clarifyArtifact?: {
    /** 产物主键。 */
    id: string;
    /** 版本号。 */
    version: number;
    /** 澄清摘要。 */
    summary: string | null;
    /** 结构化草稿。 */
    draft: unknown;
    /** 待确认问题。 */
    questions: unknown[];
  } | null;
}

/** 拆解输出：任务草稿与说明。 */
export interface BreakdownOutput {
  /** 本次生成累计 token 用量；不可用时省略。 */
  tokens?: number;
  /** 工具调用步骤（仅工具名）；用于运行轨迹。 */
  steps?: string[];
  /** 工具调用参数与结果（脱敏、截断）；用于回放。 */
  toolCalls?: ToolCallTrace[];
  /** 任务列表。 */
  tasks: BreakdownTask[];
  /** 拆解说明；无说明时为 null。 */
  summary: string | null;
}

/** 拆解端口：由 runtime 用模型实现。 */
export interface BreakdownPort {
  /** 产出任务拆解草稿。 */
  breakdown(input: BreakdownInput): Promise<BreakdownOutput>;
}
