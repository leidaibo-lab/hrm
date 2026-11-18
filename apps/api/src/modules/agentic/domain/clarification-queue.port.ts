import { AGENTIC_QUEUE } from '@cip/shared';

/** 澄清队列名。 */
export const CLARIFICATION_QUEUE_NAME = AGENTIC_QUEUE.clarification;

/** 澄清任务的 DI 令牌。 */
export const CLARIFICATION_QUEUE = Symbol('CLARIFICATION_QUEUE');

/** 澄清任务负载。 */
export interface ClarificationJob {
  /** 工单主键。 */
  ticketId: string;
  /** 线程主键。 */
  threadId: string;
  /** 触发澄清的事件主键。 */
  triggerIds: string[];
}

/** 澄清队列端口：接单后异步出稿，避免阻塞 webhook。 */
export interface ClarificationQueuePort {
  /** 投递澄清任务。 */
  enqueue(job: ClarificationJob): Promise<void>;
}
