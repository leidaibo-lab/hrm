import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { Injectable, Logger } from '@nestjs/common';
import { GatewayExportService } from '../../../model-providers/application/gateway-export.service';
import { readPolicyRules } from '../../domain/policy.entity';
import type {
  RouterDecisionInput,
  RouterDecisionPort,
  RouterDecisionResult,
} from '../../domain/router-decision.port';
import { resolveModelRoute } from './agent-role.helper';
import { ROUTER_AGENT, routerDecisionSchema } from './agents/router.agent';
import { injectionGuardProcessor } from './guardrail.helper';
import { getAgentStorage } from './storage.helper';

/**
 * Router 慢路径：用 fast 档角色判断事件是否值得进入执行。
 * 无模型路由、网关失败或输出非法时返回 null，由 RouterService 走确定性路径。
 */
@Injectable()
export class MastraRouterDecisionService implements RouterDecisionPort {
  private readonly logger = new Logger(MastraRouterDecisionService.name);

  constructor(private readonly gateway: GatewayExportService) {}

  /** 判定一批事件；不可用时返回 null。 */
  async decide(
    input: RouterDecisionInput,
  ): Promise<RouterDecisionResult | null> {
    const route = resolveModelRoute(
      readPolicyRules(input.policy.rules),
      'fast',
    );
    if (!route) return null;
    try {
      const gateway = await this.gateway.createGateway();
      const storage = await getAgentStorage();
      const agent = new Agent({
        id: 'agentic-router',
        name: ROUTER_AGENT.name,
        instructions: ROUTER_AGENT.instructions,
        model: route,
        inputProcessors: [injectionGuardProcessor],
      });
      new Mastra({
        gateways: { cip: gateway },
        storage,
        agents: { 'agentic-router': agent },
      });
      const output = await agent.generate(this.prompt(input), {
        structuredOutput: { schema: routerDecisionSchema },
      });
      const parsed = routerDecisionSchema.parse(output.object);
      return {
        relevant: parsed.relevant,
        worthProcessing: parsed.worthProcessing,
        reason: parsed.reason,
      };
    } catch (error) {
      this.logger.warn(
        `Router 慢路径失败，回退确定性路由：${
          error instanceof Error ? error.message : '未知错误'
        }`,
      );
      return null;
    }
  }

  /** 构造判定提示词；外部文本只作数据。 */
  private prompt(input: RouterDecisionInput): string {
    const texts = input.triggers
      .map((trigger) => `- ${trigger.text.slice(0, 500)}`)
      .join('\n');
    return [
      `线程：${input.threadId}`,
      '最近事件：',
      texts,
      '判断是否与研发任务相关、是否值得进入执行。',
    ].join('\n');
  }
}
