/** agentic 领域错误基类：只表达业务不变量被破坏，不携带 HTTP 语义。 */
export class AgenticDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** 线程已关闭：关闭后不再接受事件与摘要更新。 */
export class ThreadClosedError extends AgenticDomainError {
  constructor(threadId: string) {
    super(`线程 ${threadId} 已关闭`);
  }
}

/** 事件已处置：同一事件只能从 pending 迁移一次。 */
export class TriggerAlreadyDisposedError extends AgenticDomainError {
  constructor(triggerId: string, disposition: string) {
    super(`事件 ${triggerId} 已处置为 ${disposition}`);
  }
}
