/** agentic 后台队列名：api 与 worker 共用同一契约。 */
export const AGENTIC_QUEUE = {
  /** 事件路由/研判任务。 */
  routing: 'agentic-routing',
  /** 澄清出稿任务。 */
  clarification: 'agentic-clarification',
  /** 拆解任务。 */
  breakdown: 'agentic-breakdown',
  /** 闸门结果通知任务。 */
  notification: 'agentic-notification',
} as const;

/** agentic 队列名联合。 */
export type AgenticQueue = (typeof AGENTIC_QUEUE)[keyof typeof AGENTIC_QUEUE];
