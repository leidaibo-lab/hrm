import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Artifact } from '../domain/artifact.entity';
import type { Attention } from '../domain/attention.entity';
import {
  BREAKDOWN_QUEUE,
  type BreakdownQueuePort,
} from '../domain/breakdown-queue.port';
import {
  CLARIFICATION_PORT,
  type ClarificationInput,
  type ClarificationOutput,
  type ClarificationPort,
} from '../domain/clarification.port';
import { readPolicyRules } from '../domain/policy.entity';
import type { ToolCallTrace } from '../domain/tool-trace.entity';
import { ArtifactService } from './artifact.service';
import { AttentionService } from './attention.service';

/** 澄清结果：草稿产物与待确认问题。 */
export interface ClarificationResult {
  /** 澄清稿产物；低分进入人工分支时为 null。 */
  artifact: Artifact | null;
  /** 待确认关注。 */
  attentions: Attention[];
  /** 本次生成累计 token 用量。 */
  tokens?: number;
  /** 工具调用步骤（仅工具名）。 */
  steps?: string[];
  /** 工具调用参数与结果（脱敏、截断）。 */
  toolCalls?: ToolCallTrace[];
}

/** 澄清用例：模型出稿 + 产物落版本 + 问题转关注。 */
@Injectable()
export class ClarificationService {
  private readonly logger = new Logger(ClarificationService.name);

  /** 单次最多生成的问题数。 */
  static readonly MAX_QUESTIONS = 5;
  /** 澄清回答期限（72 小时）。 */
  private static readonly DEADLINE_MS = 72 * 60 * 60 * 1000;

  constructor(
    @Inject(CLARIFICATION_PORT)
    private readonly clarification: ClarificationPort,
    private readonly artifacts: ArtifactService,
    private readonly attentions: AttentionService,
    @Inject(BREAKDOWN_QUEUE)
    private readonly breakdownQueue: BreakdownQueuePort,
  ) {}

  /** 为工单生成澄清稿并创建问题。 */
  async start(input: ClarificationInput): Promise<ClarificationResult> {
    const output = await this.clarification.clarify(input);
    const deadline = new Date(Date.now() + ClarificationService.DEADLINE_MS);
    const assignee = this.resolveAssignee(input);

    // 工作流 attention 分支：只写关注并结束本次 run，不落产物。
    if (output.needsHuman === true) {
      const attention = await this.attentions.ask({
        ticketId: input.ticketId,
        kind: 'review',
        question: `澄清稿质量分 ${output.score?.toFixed(2) ?? '未知'} 低于阈值，请人工复核后重试。`,
        deadline,
        assignee,
      });
      return {
        artifact: null,
        attentions: [attention],
        tokens: output.tokens,
        steps: output.steps,
        toolCalls: output.toolCalls,
      };
    }

    const questions = output.questions.slice(
      0,
      ClarificationService.MAX_QUESTIONS,
    );
    const artifact = await this.artifacts.publish({
      ticketId: input.ticketId,
      kind: 'clarify',
      payload: {
        summary: output.summary,
        draft: output.draft,
        questions,
      },
    });

    const attentions: Attention[] = [];
    for (const question of questions) {
      attentions.push(
        await this.attentions.ask({
          ticketId: input.ticketId,
          kind: 'clarify',
          question: question.question,
          options: question.options ?? null,
          deadline,
          assignee,
        }),
      );
    }
    await this.speculateBreakdown(input, output, questions.length);
    return {
      artifact,
      attentions,
      tokens: output.tokens,
      steps: output.steps,
      toolCalls: output.toolCalls,
    };
  }

  /** 等待对象：优先最近事件发起人，其次策略升级负责人。 */
  private resolveAssignee(input: ClarificationInput): string | undefined {
    const actor = [...input.triggers]
      .reverse()
      .find((trigger) => trigger.actorUserId)?.actorUserId;
    return actor ?? readPolicyRules(input.policy.rules).escalationOwner;
  }

  /**
   * 投机执行：澄清稿无问题时后台先出拆解稿，确认后交付、修改或驳回后丢弃。
   * 受策略开关与单任务去重约束，失败不影响澄清主流程。
   */
  private async speculateBreakdown(
    input: ClarificationInput,
    output: ClarificationOutput,
    questionCount: number,
  ): Promise<void> {
    const enabled =
      readPolicyRules(input.policy.rules).speculationEnabled === true;
    if (!enabled || output.needsHuman === true || questionCount > 0) return;
    try {
      await this.breakdownQueue.enqueue({
        ticketId: input.ticketId,
        threadId: input.threadId,
        triggerIds: input.triggers.map((trigger) => trigger.id),
        speculative: true,
      });
    } catch (error) {
      this.logger.warn(
        `投机拆解投递失败：${
          error instanceof Error ? error.message : '未知错误'
        }`,
      );
    }
  }
}
