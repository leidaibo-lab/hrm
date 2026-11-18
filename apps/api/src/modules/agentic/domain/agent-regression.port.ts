/** 单条回归用例结果。 */
export interface RegressionCaseResult {
  /** 用例标识。 */
  caseId: string;
  /** 0–1 覆盖率分数。 */
  score: number;
  /** 是否达到阈值。 */
  passed: boolean;
  /** 未覆盖的期望关键词。 */
  missing: string[];
}

/** Agent 回归报告。 */
export interface AgentRegressionReport {
  /** 角色键。 */
  agentKey: string;
  /** 通过阈值。 */
  threshold: number;
  /** 总分（用例均分）。 */
  score: number;
  /** 是否整体通过。 */
  passed: boolean;
  /** 用例明细。 */
  cases: RegressionCaseResult[];
  /** 运行时间。 */
  ranAt: string;
}

/** 回归运行端口：由 runtime 调模型执行；application 只依赖契约。 */
export interface AgentRegressionPort {
  /** 运行指定角色的回归用例。 */
  run(input: {
    agentKey: string;
    threshold: number;
  }): Promise<AgentRegressionReport>;
}

/** 回归端口的 DI 令牌。 */
export const AGENT_REGRESSION_PORT = Symbol('AGENT_REGRESSION_PORT');
