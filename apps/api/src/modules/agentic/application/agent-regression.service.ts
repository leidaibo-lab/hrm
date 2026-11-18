import { Inject, Injectable } from '@nestjs/common';
import {
  AGENT_REGRESSION_PORT,
  type AgentRegressionPort,
  type AgentRegressionReport,
} from '../domain/agent-regression.port';

export {
  AgentRegressionUnavailableError,
  AgentRegressionUnsupportedError,
} from '../domain/agent-regression.error';

export type { AgentRegressionReport } from '../domain/agent-regression.port';

import { readPolicyRules } from '../domain/policy.entity';
import {
  POLICY_REPOSITORY,
  type PolicyRepository,
} from '../domain/policy.repository';

/** 默认回归阈值。 */
export const DEFAULT_REGRESSION_THRESHOLD = 0.8;

/** Agent 回归用例：阈值解析、运行与发布前门禁。 */
@Injectable()
export class AgentRegressionService {
  constructor(
    @Inject(AGENT_REGRESSION_PORT)
    private readonly regression: AgentRegressionPort,
    @Inject(POLICY_REPOSITORY)
    private readonly policies: PolicyRepository,
  ) {}

  /** 运行回归；阈值取显式值，否则当前策略 regressionThreshold，最后默认 0.8。 */
  async run(
    agentKey: string,
    threshold?: number,
  ): Promise<AgentRegressionReport> {
    return this.regression.run({
      agentKey,
      threshold: threshold ?? (await this.policyThreshold()),
    });
  }

  private async policyThreshold(): Promise<number> {
    const policy = await this.policies.findCurrent();
    const value = policy
      ? readPolicyRules(policy.rules).regressionThreshold
      : undefined;
    return value ?? DEFAULT_REGRESSION_THRESHOLD;
  }
}
