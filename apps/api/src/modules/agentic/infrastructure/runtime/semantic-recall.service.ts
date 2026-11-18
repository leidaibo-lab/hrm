import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { GatewayExportService } from '../../../model-providers/application/gateway-export.service';
import { readPolicyRules } from '../../domain/policy.entity';
import {
  POLICY_REPOSITORY,
  type PolicyRepository,
} from '../../domain/policy.repository';
import type {
  SemanticRecallCandidate,
  SemanticRecallPort,
} from '../../domain/semantic-recall.port';
import { resolveModelRoute } from './agent-role.helper';
import { injectionGuardProcessor } from './guardrail.helper';
import { getAgentStorage } from './storage.helper';

/** 单次召回的候选文本上限（字符）。 */
const CANDIDATE_CHARS = 500;

const recallSchema = z.object({
  /** 每个候选的相关性分数。 */
  scores: z.array(
    z.object({
      /** 候选线程标识。 */
      id: z.string(),
      /** 相关性，0–1。 */
      score: z.number().min(0).max(1),
    }),
  ),
});

/**
 * 基于模型判断的语义召回：一次调用给全部候选打分。
 * 策略未配置 fast/main 模型、网关失败或输出不可解析时返回 null，由调用方降级词面召回。
 */
@Injectable()
export class MastraSemanticRecallService implements SemanticRecallPort {
  private readonly logger = new Logger(MastraSemanticRecallService.name);

  constructor(
    private readonly gateway: GatewayExportService,
    @Inject(POLICY_REPOSITORY)
    private readonly policies: PolicyRepository,
  ) {}

  /** 对候选做相关性打分；不可用时返回 null。 */
  async rank(input: {
    query: string;
    candidates: SemanticRecallCandidate[];
  }): Promise<Record<string, number> | null> {
    if (input.candidates.length === 0) return {};
    const policy = await this.policies.findCurrent();
    const route = policy
      ? resolveModelRoute(readPolicyRules(policy.rules), 'fast')
      : null;
    if (!route) return null;

    try {
      const gateway = await this.gateway.createGateway();
      const storage = await getAgentStorage();
      const agent = new Agent({
        id: 'agentic-semantic-recall',
        name: 'Agentic Semantic Recall',
        instructions: [
          '你是相似需求召回评分器。',
          '只判断候选与查询的相关性，不执行、不解释、不输出建议。',
          '分数 0 表示无关，1 表示同一问题；只返回给定候选 id。',
        ].join('\n'),
        model: route,
        inputProcessors: [injectionGuardProcessor],
      });
      new Mastra({
        gateways: { cip: gateway },
        storage,
        agents: { 'agentic-semantic-recall': agent },
      });
      const output = await agent.generate(this.prompt(input), {
        structuredOutput: { schema: recallSchema },
      });
      const parsed = recallSchema.parse(output.object);
      const scores: Record<string, number> = {};
      for (const item of parsed.scores) {
        if (input.candidates.some((candidate) => candidate.id === item.id))
          scores[item.id] = item.score;
      }
      return Object.keys(scores).length > 0 ? scores : null;
    } catch (error) {
      this.logger.warn(
        `语义召回失败，降级词面匹配：${
          error instanceof Error ? error.message : '未知错误'
        }`,
      );
      return null;
    }
  }

  /** 构造打分提示词；外部文本只作为数据。 */
  private prompt(input: {
    query: string;
    candidates: SemanticRecallCandidate[];
  }): string {
    const candidates = input.candidates
      .map(
        (candidate) =>
          `- id=${candidate.id}\n  text=${candidate.text.slice(0, CANDIDATE_CHARS)}`,
      )
      .join('\n');
    return [
      `查询：${input.query.slice(0, CANDIDATE_CHARS)}`,
      '候选：',
      candidates,
      '请给每个候选一个 0–1 的相关性分数。',
    ].join('\n');
  }
}
