import { Agent, type ToolsInput } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { Memory } from '@mastra/memory';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { RedisService } from '../../../../platform/redis';
import { GatewayExportService } from '../../../model-providers/application/gateway-export.service';
import type { ArtifactRepository } from '../../domain/artifact.repository';
import { ARTIFACT_REPOSITORY } from '../../domain/artifact.repository';
import {
  type AssessmentInput,
  type AssessmentPort,
  type AssessmentResult,
} from '../../domain/assessment.port';
import { readPolicyRules } from '../../domain/policy.entity';
import { RECALL_PORT, type RecallPort } from '../../domain/recall.port';
import type { TicketRepository } from '../../domain/ticket.repository';
import { TICKET_REPOSITORY } from '../../domain/ticket.repository';
import {
  TOOL_ACCESS,
  type ToolAccessPort,
} from '../../domain/tool-access.port';
import type { TriggerRepository } from '../../domain/trigger.repository';
import { TRIGGER_REPOSITORY } from '../../domain/trigger.repository';
import { resolveModelRoute } from './agent-role.helper';
import { ASSESS_AGENT, assessmentSchema } from './agents/assess.agent';
import {
  injectionGuardProcessor,
  piiRedactionProcessor,
} from './guardrail.helper';
import { RedisServerCache } from './redis-cache.helper';
import { getAgentStorage } from './storage.helper';
import { createReadTicketTool } from './tools/read-ticket.tool';
import { createSearchSimilarTool } from './tools/search-similar.tool';

/**
 * 模型研判适配器：按策略配置的模型路由调用 Mastra Agent。
 * 未配置模型或调用失败时返回 unavailable，让事件仍留下结论。
 */
@Injectable()
export class MastraAssessmentService implements AssessmentPort {
  private readonly logger = new Logger(MastraAssessmentService.name);

  constructor(
    private readonly gateway: GatewayExportService,
    private readonly redis: RedisService,
    @Inject(TICKET_REPOSITORY) private readonly tickets: TicketRepository,
    @Inject(ARTIFACT_REPOSITORY)
    private readonly artifacts: ArtifactRepository,
    @Inject(TRIGGER_REPOSITORY)
    private readonly triggers: TriggerRepository,
    @Inject(RECALL_PORT)
    private readonly recall: RecallPort,
    @Optional()
    @Inject(TOOL_ACCESS)
    private readonly toolAccess?: ToolAccessPort,
  ) {}

  /** 对一批事件给出结论。 */
  async assess(input: AssessmentInput): Promise<AssessmentResult> {
    const route = this.modelRoute(input);
    if (!route) return this.unavailable('策略未配置 assessmentModel');

    try {
      const gateway = await this.gateway.createGateway();
      const storage = await getAgentStorage();
      const agent = new Agent({
        id: 'agentic-assessment',
        name: ASSESS_AGENT.name,
        instructions: ASSESS_AGENT.instructions,
        model: route,
        inputProcessors: [injectionGuardProcessor],
        outputProcessors: [piiRedactionProcessor],
        tools: this.tools(
          input.triggers[0]?.scopeKey ?? null,
          input.triggers[0]?.actorUserId ?? null,
        ),
        ...(storage ? { memory: new Memory({ storage }) } : {}),
      });
      new Mastra({
        gateways: { cip: gateway },
        storage,
        agents: { 'agentic-assessment': agent },
        recovery: { durableAgents: 'auto' },
      });

      const durable = createDurableAgent({
        agent,
        cache: new RedisServerCache(this.redis),
      }) as unknown as Agent;
      const output = await durable.generate(this.prompt(input), {
        structuredOutput: { schema: assessmentSchema },
      });
      const parsed = assessmentSchema.parse(output.object);
      return {
        kind: parsed.kind,
        strength: parsed.strength,
        scope: parsed.scope,
        matchedRuleIds: parsed.matchedRuleIds,
        reason: parsed.reason,
        ticketKind: parsed.ticketKind,
      };
    } catch (error) {
      this.logger.warn(
        `模型研判失败：${error instanceof Error ? error.message : '未知错误'}`,
      );
      return this.unavailable('模型研判失败');
    }
  }

  private modelRoute(input: AssessmentInput): string | null {
    return resolveModelRoute(readPolicyRules(input.policy.rules), 'main');
  }

  /** 装配研判角色工具白名单；工具只允许在本 scope 内读取与召回。 */
  private tools(
    scopeKey: string | null,
    actorUserId: string | null,
  ): ToolsInput {
    const access = this.toolAccess;
    const authorize = access
      ? (tool: string) =>
          access.authorize({
            actorUserId,
            role: 'assess',
            tool,
            scopeKey,
          })
      : undefined;
    const available = {
      'read-ticket': createReadTicketTool({
        tickets: this.tickets,
        artifacts: this.artifacts,
        scopeKey,
        authorize,
      }),
      'search-similar': createSearchSimilarTool({
        recall: this.recall,
        scopeKey,
        authorize,
      }),
    };
    return Object.fromEntries(
      ASSESS_AGENT.tools
        .filter((id) => id in available)
        .map((id) => [id, available[id as keyof typeof available]]),
    );
  }

  private prompt(input: AssessmentInput): string {
    return JSON.stringify({
      threadId: input.threadId,
      policy: {
        id: input.policy.id,
        version: input.policy.version,
        rules: input.policy.rules,
      },
      triggers: input.triggers.map((trigger) => ({
        id: trigger.id,
        actorId: trigger.actorId,
        addressed: trigger.addressed,
        text: trigger.text,
        occurredAt: trigger.occurredAt.toISOString(),
      })),
    });
  }

  private unavailable(reason: string): AssessmentResult {
    return {
      kind: 'unavailable',
      strength: 'inferred',
      scope: {},
      matchedRuleIds: null,
      reason,
      ticketKind: 'requirement',
    };
  }
}
