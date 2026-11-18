import type { Policy } from './policy.entity';
import type { ToolCallTrace } from './tool-trace.entity';
import type { Trigger } from './trigger.entity';

/** 澄清端口的 DI 令牌。 */
export const CLARIFICATION_PORT = Symbol('CLARIFICATION_PORT');

/** 澄清问题。 */
export interface ClarificationQuestion {
  /** 问题文本。 */
  question: string;
  /** 可选答案。 */
  options?: string[] | null;
}

/** 澄清输入：事件批次与当前策略。 */
export interface ClarificationInput {
  /** 所属线程主键。 */
  threadId: string;
  /** 所属工单主键。 */
  ticketId: string;
  /** 事件批次。 */
  triggers: Trigger[];
  /** 当前策略。 */
  policy: Policy;
}

/** 澄清输出：摘要、结构化草稿与待确认问题。 */
export interface ClarificationOutput {
  /** 本次生成累计 token 用量；不可用时省略。 */
  tokens?: number;
  /** 工具调用步骤（仅工具名）；用于运行轨迹。 */
  steps?: string[];
  /** 工具调用参数与结果（脱敏、截断）；用于回放。 */
  toolCalls?: ToolCallTrace[];
  /** 摘要。 */
  summary: string;
  /** 结构化草稿。 */
  draft: unknown;
  /** 待确认问题，最多 5 个。 */
  questions: ClarificationQuestion[];
  /** 质量分，0–1；未评分时为 undefined。 */
  score?: number;
  /** 是否需要人工复核（低分产物进入人工分支）。 */
  needsHuman?: boolean;
}

/** 澄清端口：由 runtime 用模型实现。 */
export interface ClarificationPort {
  /** 生成澄清稿与问题。 */
  clarify(input: ClarificationInput): Promise<ClarificationOutput>;
}
