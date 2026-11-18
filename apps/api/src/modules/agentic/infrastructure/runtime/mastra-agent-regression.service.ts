import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { Inject, Injectable } from '@nestjs/common';
import { GatewayExportService } from '../../../model-providers/application/gateway-export.service';
import {
  AgentRegressionUnavailableError,
  AgentRegressionUnsupportedError,
} from '../../domain/agent-regression.error';
import type {
  AgentRegressionPort,
  AgentRegressionReport,
  RegressionCaseResult,
} from '../../domain/agent-regression.port';
import { readPolicyRules } from '../../domain/policy.entity';
import {
  POLICY_REPOSITORY,
  type PolicyRepository,
} from '../../domain/policy.repository';
import { resolveModelRoute } from './agent-role.helper';
import { CLARIFY_AGENT, clarifyOutputSchema } from './agents/clarify.agent';
import { getAgentStorage } from './storage.helper';

/** 单条回归用例：输入文本与期望覆盖的关键词。 */
export interface RegressionCase {
  /** 用例标识。 */
  id: string;
  /** 输入文本。 */
  text: string;
  /** 期望在输出中出现的关键词。 */
  expectedKeywords: string[];
}

/**
 * 种子回归用例：覆盖导出、缺陷、异步改造三类澄清场景。
 * 产品补充用例时保持同一结构；阈值由策略 regressionThreshold 控制。
 */
export const CLARIFY_REGRESSION_CASES: readonly RegressionCase[] =
  Object.freeze([
    {
      id: 'clarify-export',
      text: '飞书表格新增需求：希望导出上月订单，按项目分组，本周五前给结果。',
      expectedKeywords: ['导出', '订单', '项目'],
    },
    {
      id: 'clarify-bug',
      text: '登录页在 Safari 上点击登录无反应，昨天开始，影响所有用户。',
      expectedKeywords: ['登录', 'Safari', '用户'],
    },
    {
      id: 'clarify-async',
      text: '需要把报表下载改成异步任务，避免请求超时。',
      expectedKeywords: ['报表', '异步', '超时'],
    },
  ]);

/** 关键词覆盖率：命中数 / 期望数；空期望返回 0。 */
export function scoreKeywords(output: unknown, expected: string[]): number {
  if (expected.length === 0) return 0;
  const text = JSON.stringify(output).toLowerCase();
  const hits = expected.filter((keyword) =>
    text.includes(keyword.toLowerCase()),
  ).length;
  return hits / expected.length;
}

/** 用 fast/main 档角色跑澄清种子用例并输出回归报告。 */
@Injectable()
export class MastraAgentRegressionService implements AgentRegressionPort {
  constructor(
    private readonly gateway: GatewayExportService,
    @Inject(POLICY_REPOSITORY)
    private readonly policies: PolicyRepository,
  ) {}

  /** 运行指定角色的回归；当前种子集只覆盖 clarify。 */
  async run(input: {
    agentKey: string;
    threshold: number;
  }): Promise<AgentRegressionReport> {
    if (input.agentKey !== CLARIFY_AGENT.key)
      throw new AgentRegressionUnsupportedError(input.agentKey);
    const policy = await this.policies.findCurrent();
    if (!policy)
      throw new AgentRegressionUnavailableError('回归运行缺少当前策略');
    const route = resolveModelRoute(readPolicyRules(policy.rules), 'main');
    if (!route)
      throw new AgentRegressionUnavailableError(
        '策略未配置 mainModel/assessmentModel',
      );

    const gateway = await this.gateway.createGateway();
    const storage = await getAgentStorage();
    const agent = new Agent({
      id: 'agentic-regression-clarify',
      name: 'Agentic Clarification Regression',
      instructions: CLARIFY_AGENT.instructions,
      model: route,
    });
    new Mastra({
      gateways: { cip: gateway },
      storage,
      agents: { 'agentic-regression-clarify': agent },
    });

    const cases: RegressionCaseResult[] = [];
    for (const item of CLARIFY_REGRESSION_CASES) {
      const output = await agent.generate(this.prompt(item.text), {
        structuredOutput: { schema: clarifyOutputSchema },
      });
      const score = scoreKeywords(output.object, item.expectedKeywords);
      const missing = item.expectedKeywords.filter(
        (keyword) =>
          !JSON.stringify(output.object)
            .toLowerCase()
            .includes(keyword.toLowerCase()),
      );
      cases.push({
        caseId: item.id,
        score,
        passed: score >= input.threshold,
        missing,
      });
    }
    const score =
      cases.reduce((sum, item) => sum + item.score, 0) / cases.length;
    return {
      agentKey: input.agentKey,
      threshold: input.threshold,
      score,
      passed: cases.every((item) => item.passed),
      cases,
      ranAt: new Date().toISOString(),
    };
  }

  private prompt(text: string): string {
    return `请对以下需求做澄清，输出结构化摘要、草稿与最多 5 个问题：\n${text}`;
  }
}
