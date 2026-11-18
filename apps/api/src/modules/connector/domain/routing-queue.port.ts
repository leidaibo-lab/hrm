import { AGENTIC_QUEUE } from '@cip/shared';

/** 事件路由队列名。 */
export const ROUTING_QUEUE_NAME = AGENTIC_QUEUE.routing;

/** 事件路由队列的 DI 令牌。 */
export const ROUTING_QUEUE = Symbol('ROUTING_QUEUE');

/** 事件路由任务负载。 */
export interface RoutingJob {
  /** 事件主键。 */
  triggerId: string;
  /** 源实例主键。 */
  sourceInstanceId: string;
  /** 范围行（项目、群或表格）。 */
  scopeRow: string;
  /** 是否点名机器人。 */
  addressed: boolean;
  /** 源内发起人标识。 */
  actorId: string;
  /** 平台用户标识。 */
  actorUserId?: string | null;
  /** 来源类型。 */
  sourceType: string;
  /** 项目或空间标识。 */
  scopeKey?: string | null;
  /** 入站时间（ISO）。 */
  at: string;
}

/** 事件路由队列端口：回调只落库入队，研判在 worker 内异步执行。 */
export interface RoutingQueuePort {
  /** 投递路由任务；同一事件 jobId 去重。 */
  enqueue(job: RoutingJob): Promise<void>;
}
