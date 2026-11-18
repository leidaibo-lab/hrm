import { AGENTIC_QUEUE } from '@cip/shared';

/** 拆解队列名。 */
export const BREAKDOWN_QUEUE_NAME = AGENTIC_QUEUE.breakdown;

/** 拆解任务的 DI 令牌。 */
export const BREAKDOWN_QUEUE = Symbol('BREAKDOWN_QUEUE');

/** 拆解任务负载。 */
export interface BreakdownJob {
  /** 工单主键。 */
  ticketId: string;
  /** 线程主键。 */
  threadId: string;
  /** 上下文事件主键。 */
  triggerIds: string[];
  /** 是否为投机执行：先出稿，澄清确认后才交付。 */
  speculative?: boolean;
}

/** 拆解队列端口：澄清确认后异步出拆解稿，避免阻塞闸门。 */
export interface BreakdownQueuePort {
  /** 投递拆解任务。 */
  enqueue(job: BreakdownJob): Promise<void>;
}
