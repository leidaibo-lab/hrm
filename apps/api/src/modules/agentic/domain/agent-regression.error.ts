/** 回归目标不支持：角色无种子用例。 */
export class AgentRegressionUnsupportedError extends Error {
  constructor(readonly agentKey: string) {
    super(`暂无可运行的回归用例：${agentKey}`);
    this.name = 'AgentRegressionUnsupportedError';
  }
}

/** 回归依赖不可用：策略或模型路由缺失。 */
export class AgentRegressionUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentRegressionUnavailableError';
  }
}
