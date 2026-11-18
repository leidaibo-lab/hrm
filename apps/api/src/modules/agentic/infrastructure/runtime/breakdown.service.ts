import { Agent, type ToolsInput } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { Memory } from '@mastra/memory';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { RedisService } from '../../../../platform/redis';
import { GatewayExportService } from '../../../model-providers/application/gateway-export.service';
import type { ArtifactRepository } from '../../domain/artifact.repository';
import { ARTIFACT_REPOSITORY } from '../../domain/artifact.repository';
import type { AttentionRepository } from '../../domain/attention.repository';
import { ATTENTION_REPOSITORY } from '../../domain/attention.repository';
import {
  type BreakdownInput,
  type BreakdownOutput,
  type BreakdownPort,
} from '../../domain/breakdown.port';
import type { DecisionRepository } from '../../domain/decision.repository';
import { DECISION_REPOSITORY } from '../../domain/decision.repository';
import { metrics } from '../../domain/metrics.port';
import { readPolicyRules } from '../../domain/policy.entity';
import { RECALL_PORT, type RecallPort } from '../../domain/recall.port';
import type { ThreadRepository } from '../../domain/thread.repository';
import { THREAD_REPOSITORY } from '../../domain/thread.repository';
import type { TicketRepository } from '../../domain/ticket.repository';
import { TICKET_REPOSITORY } from '../../domain/ticket.repository';
import {
  TOOL_ACCESS,
  type ToolAccessPort,
} from '../../domain/tool-access.port';
import type { ToolCallTrace } from '../../domain/tool-trace.entity';
import type { TriggerRepository } from '../../domain/trigger.repository';
import { TRIGGER_REPOSITORY } from '../../domain/trigger.repository';
import { resolveModelRoute } from './agent-role.helper';
import {
  BREAKDOWN_AGENT,
  BREAKDOWN_GOAL,
  breakdownOutputSchema,
} from './agents/breakdown.agent';
import { buildContextBundle } from './context.helper';
import {
  assertTokenBudget,
  guardPrompt,
  injectionGuardProcessor,
  piiRedactionProcessor,
  readToolCalls,
  readTotalTokens,
} from './guardrail.helper';
import { RedisServerCache } from './redis-cache.helper';
import { getAgentStorage } from './storage.helper';
import { createReadTicketTool } from './tools/read-ticket.tool';
import { createSearchSimilarTool } from './tools/search-similar.tool';
import {
  type BreakdownWorkflowDeps,
  createBreakdownWorkflow,
} from './workflows/breakdown.workflow';

/** 拆解工作流在 Goal 中使用的线程命名空间。 */
const GOAL_THREAD_PREFIX = 'agentic-breakdown:';

/** 单次运行默认超时（毫秒）。 */
const DEFAULT_RUN_TIMEOUT_MS = 120_000;

/**
 * 拆解适配器：用拆解角色 + 拆解工作流产出任务草稿。
 * 工作流负责步骤顺序，适配器只负责模型调用与工具装配。
 */
@Injectable()
export class MastraBreakdownService implements BreakdownPort {
  private readonly logger = new Logger(MastraBreakdownService.name);

  constructor(
    private readonly gateway: GatewayExportService,
    private readonly redis: RedisService,
    @Inject(TICKET_REPOSITORY) private readonly tickets: TicketRepository,
    @Inject(ARTIFACT_REPOSITORY)
    private readonly artifacts: ArtifactRepository,
    @Inject(THREAD_REPOSITORY) private readonly threads: ThreadRepository,
    @Inject(TRIGGER_REPOSITORY)
    private readonly triggers: TriggerRepository,
    @Inject(DECISION_REPOSITORY)
    private readonly decisions: DecisionRepository,
    @Inject(ATTENTION_REPOSITORY)
    private readonly attentions: AttentionRepository,
    @Inject(RECALL_PORT)
    private readonly recall: RecallPort,
    @Optional()
    @Inject(TOOL_ACCESS)
    private readonly toolAccess?: ToolAccessPort,
  ) {}

  /** 产出任务拆解草稿。 */
  async breakdown(input: BreakdownInput): Promise<BreakdownOutput> {
    const rules = readPolicyRules(input.policy.rules);
    const route = resolveModelRoute(rules, 'main');
    if (!route) throw new Error('策略未配置 mainModel/assessmentModel');

    const usage: {
      tokens: number;
      steps: string[];
      toolCalls: ToolCallTrace[];
    } = {
      tokens: 0,
      steps: [],
      toolCalls: [],
    };
    const workflow = createBreakdownWorkflow(
      this.workflowDeps(input, route, usage),
    );
    const run = await workflow.createRun();
    const result = await run.start({
      inputData: { ticketId: input.ticketId, threadId: input.threadId },
    });
    if (result.status !== 'success')
      throw new Error(
        `拆解工作流失败：${result.status === 'failed' ? result.error.message : result.status}`,
      );

    return {
      tasks: result.result.tasks,
      summary: result.result.summary,
      tokens: usage.tokens,
      steps: usage.steps,
      toolCalls: usage.toolCalls,
    };
  }

  /** 工作流依赖：上下文装载与角色调用。 */
  private workflowDeps(
    input: BreakdownInput,
    route: string,
    usage: { tokens: number; steps: string[]; toolCalls: ToolCallTrace[] },
  ): BreakdownWorkflowDeps {
    return {
      loadContext: async ({ ticketId, threadId }) => ({
        ticketId,
        threadId,
        prompt: await this.buildPrompt(
          input,
          (await this.tickets.findById(ticketId))?.isOpen === true,
        ),
      }),
      generate: async (context) => {
        const output = await this.generateDraft(context.prompt, route, input);
        usage.tokens += readTotalTokens(output) ?? 0;
        const calls = readToolCalls(
          output,
          readPolicyRules(input.policy.rules).auditRedactFields ?? [],
        );
        usage.toolCalls.push(...calls);
        usage.steps.push(...calls.map((call) => call.name));
        return output;
      },
    };
  }

  /** 构建角色 Agent 并执行结构化生成。 */
  private async generateDraft(
    prompt: string,
    route: string,
    input: BreakdownInput,
  ): Promise<BreakdownOutput> {
    const gateway = await this.gateway.createGateway();
    const storage = await getAgentStorage();
    const scopeKey = await this.resolveScopeKey(input);
    const judgeRoute =
      resolveModelRoute(readPolicyRules(input.policy.rules), 'judge') ?? route;
    const agent = new Agent({
      id: 'agentic-breakdown',
      name: BREAKDOWN_AGENT.name,
      instructions: BREAKDOWN_AGENT.instructions,
      model: route,
      inputProcessors: [injectionGuardProcessor],
      outputProcessors: [piiRedactionProcessor],
      tools: this.tools(scopeKey, input.triggers[0]?.actorUserId ?? null),
      ...(storage
        ? {
            memory: new Memory({ storage }),
            goal: { judge: judgeRoute, maxRuns: BREAKDOWN_GOAL.maxRuns },
          }
        : {}),
    });
    new Mastra({
      gateways: { cip: gateway },
      storage,
      agents: { 'agentic-breakdown': agent },
      recovery: { durableAgents: 'auto' },
    });
    const durable = createDurableAgent({
      agent,
      cache: new RedisServerCache(this.redis),
    }) as unknown as Agent;
    const threadId = `${GOAL_THREAD_PREFIX}${input.ticketId}`;
    try {
      await durable.setObjective(BREAKDOWN_GOAL.objective, {
        threadId,
        resourceId: 'agentic',
        judgeModelId: judgeRoute,
        maxRuns: BREAKDOWN_GOAL.maxRuns,
        prompt: BREAKDOWN_GOAL.judgePrompt,
      });
    } catch (error) {
      this.logger.warn(
        `拆解目标设置失败，按单轮执行：${
          error instanceof Error ? error.message : '未知错误'
        }`,
      );
    }
    try {
      return await this.generateWithRetry(durable, prompt, input);
    } finally {
      await this.clearGoal(durable, threadId);
    }
  }

  /** 单次生成：按策略超时中止，避免 worker 长期占用。 */
  private async generateOnce(
    durable: Agent,
    prompt: string,
    threadId: string,
    timeoutMs: number,
    tokenBudget: number | undefined,
  ): Promise<Awaited<ReturnType<Agent['generate']>>> {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(new Error(`运行超时（${timeoutMs}ms）`)),
      timeoutMs,
    );
    try {
      const output = await durable.generate(prompt, {
        structuredOutput: { schema: breakdownOutputSchema },
        memory: { thread: threadId, resource: 'agentic' },
        abortSignal: controller.signal,
      });
      const usedTokens = readTotalTokens(output);
      if (usedTokens !== null)
        metrics.observe('agentic_tokens_total', usedTokens);
      assertTokenBudget(usedTokens, tokenBudget);
      return output;
    } finally {
      clearTimeout(timer);
    }
  }

  /** 结构化输出失败重试一次；仍失败抛出，由上层转人工。 */
  private async generateWithRetry(
    durable: Agent,
    prompt: string,
    input: BreakdownInput,
  ): Promise<ReturnType<typeof breakdownOutputSchema.parse>> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const output = await this.generateOnce(
          durable,
          prompt,
          input.threadId,
          readPolicyRules(input.policy.rules).runTimeoutMs ??
            DEFAULT_RUN_TIMEOUT_MS,
          readPolicyRules(input.policy.rules).runTokenBudget,
        );
        return breakdownOutputSchema.parse(output.object);
      } catch (error) {
        lastError = error;
        if (attempt < 2)
          this.logger.warn(
            `拆解结构化输出失败，重试一次：${
              error instanceof Error ? error.message : '未知错误'
            }`,
          );
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error('拆解结构化输出失败');
  }

  /** 运行结束清除 Goal；清除失败只告警，不影响本次结果。 */
  private async clearGoal(durable: Agent, threadId: string): Promise<void> {
    try {
      await durable.clearObjective({ threadId });
    } catch (error) {
      this.logger.warn(
        `拆解目标清除失败：${
          error instanceof Error ? error.message : '未知错误'
        }`,
      );
    }
  }

  /** 当前工单范围：工具只允许在本 scope 内读取与召回。 */
  private async resolveScopeKey(input: BreakdownInput): Promise<string | null> {
    const ticket = await this.tickets.findById(input.ticketId);
    return ticket?.scopeKey ?? input.triggers[0]?.scopeKey ?? null;
  }

  /** 装配拆解角色工具白名单：只暴露角色声明的工具。 */
  private tools(
    scopeKey: string | null,
    actorUserId: string | null,
  ): ToolsInput {
    const access = this.toolAccess;
    const authorize = access
      ? (tool: string) =>
          access.authorize({
            actorUserId,
            role: 'breakdown',
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
      BREAKDOWN_AGENT.tools
        .filter((id) => id in available)
        .map((id) => [id, available[id as keyof typeof available]]),
    );
  }

  /** 装配事实链上下文并压成角色可读的 JSON 提示词。 */
  private async buildPrompt(
    input: BreakdownInput,
    ticketOpen: boolean,
  ): Promise<string> {
    const context = await buildContextBundle(
      {
        threads: this.threads,
        triggers: this.triggers,
        artifacts: this.artifacts,
        decisions: this.decisions,
        attentions: this.attentions,
      },
      {
        threadId: input.threadId,
        ticketId: input.ticketId,
        triggers: input.triggers,
        policy: input.policy,
        ticketOpen,
      },
    );
    const guarded = guardPrompt(
      JSON.stringify({
        context: {
          ...(context.bundle as Record<string, unknown>),
          clarifyArtifact: input.clarifyArtifact ?? null,
        },
        digest: context.digest,
        truncated: context.truncated,
      }),
    );
    if (guarded.injectionPatterns.length > 0)
      this.logger.warn(
        `拆解输入命中注入特征：${guarded.injectionPatterns.join(', ')}`,
      );
    return guarded.prompt;
  }
}
