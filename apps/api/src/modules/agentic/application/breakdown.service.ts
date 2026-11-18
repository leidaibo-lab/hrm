import { Inject, Injectable } from '@nestjs/common';
import type { Artifact } from '../domain/artifact.entity';
import {
  ARTIFACT_REPOSITORY,
  type ArtifactRepository,
} from '../domain/artifact.repository';
import type { Attention } from '../domain/attention.entity';
import {
  BREAKDOWN_PORT,
  type BreakdownInput,
  type BreakdownPort,
} from '../domain/breakdown.port';
import { readPolicyRules } from '../domain/policy.entity';
import type { ToolCallTrace } from '../domain/tool-trace.entity';
import { ArtifactService } from './artifact.service';
import { AttentionService } from './attention.service';

/** 拆解结果：草稿产物与确认关注；投机执行未交付时关注为 null。 */
export interface BreakdownResult {
  /** 拆解稿产物。 */
  artifact: Artifact;
  /** 待确认关注；投机产物交付前为 null。 */
  attention: Attention | null;
  /** 本次生成累计 token 用量。 */
  tokens?: number;
  /** 工具调用步骤（仅工具名）。 */
  steps?: string[];
  /** 工具调用参数与结果（脱敏、截断）。 */
  toolCalls?: ToolCallTrace[];
}

/** 拆解执行选项。 */
export interface BreakdownRunOptions {
  /** 投机执行：只出稿不建关注，等澄清确认后再交付。 */
  speculative?: boolean;
}

/** 拆解用例：模型出稿 + 产物落版本 + 转人工确认。 */
@Injectable()
export class BreakdownService {
  /** 确认拆解稿的回答期限（72 小时）。 */
  private static readonly DEADLINE_MS = 72 * 60 * 60 * 1000;

  constructor(
    @Inject(BREAKDOWN_PORT) private readonly breakdown: BreakdownPort,
    @Inject(ARTIFACT_REPOSITORY)
    private readonly artifactsRepository: ArtifactRepository,
    private readonly artifacts: ArtifactService,
    private readonly attentions: AttentionService,
  ) {}

  /** 为工单生成拆解稿；投机模式只落草稿，不打扰人。 */
  async start(
    input: BreakdownInput,
    options: BreakdownRunOptions = {},
  ): Promise<BreakdownResult> {
    const output = await this.breakdown.breakdown(input);
    const artifact = await this.artifacts.publish({
      ticketId: input.ticketId,
      kind: 'breakdown',
      payload: {
        summary: output.summary,
        tasks: output.tasks,
        ...(options.speculative ? { speculative: true } : {}),
      },
    });
    if (options.speculative)
      return {
        artifact,
        attention: null,
        tokens: output.tokens,
        steps: output.steps,
        toolCalls: output.toolCalls,
      };
    return {
      artifact,
      attention: await this.deliverConfirmation(input.ticketId, input),
      tokens: output.tokens,
      steps: output.steps,
      toolCalls: output.toolCalls,
    };
  }

  /**
   * 交付已生成的投机拆解稿：以新版本去掉投机标记并建确认关注。
   * 没有可交付的投机草稿时返回 false，由调用方走正常拆解任务。
   */
  async deliverSpeculative(ticketId: string): Promise<boolean> {
    const speculative = await this.latestSpeculative(ticketId);
    if (!speculative) return false;

    const payload = speculative.payload as {
      summary?: string | null;
      tasks?: unknown[];
    };
    await this.artifacts.publish({
      ticketId,
      kind: 'breakdown',
      payload: {
        summary: payload.summary ?? null,
        tasks: payload.tasks ?? [],
      },
    });
    await this.artifacts.supersede(speculative.id);
    await this.deliverConfirmation(ticketId, null);
    return true;
  }

  /** 丢弃投机拆解稿：澄清被修改或驳回后调用，避免交付过期内容。 */
  async discardSpeculative(ticketId: string): Promise<boolean> {
    const speculative = await this.latestSpeculative(ticketId);
    if (!speculative) return false;
    await this.artifacts.supersede(speculative.id);
    return true;
  }

  /** 创建拆解稿确认关注；等待对象取策略升级负责人。 */
  private async deliverConfirmation(
    ticketId: string,
    input: BreakdownInput | null,
  ): Promise<Attention> {
    const latest = await this.artifactsRepository.findLatest(
      ticketId,
      'breakdown',
    );
    const tasks = (latest?.payload as { tasks?: unknown[] } | null)?.tasks;
    return this.attentions.ask({
      ticketId,
      kind: 'confirm',
      question: `拆解稿已生成 ${Array.isArray(tasks) ? tasks.length : 0} 个任务，请确认。`,
      deadline: new Date(Date.now() + BreakdownService.DEADLINE_MS),
      assignee: input
        ? readPolicyRules(input.policy.rules).escalationOwner
        : undefined,
    });
  }

  /** 取最新一版投机拆解草稿；没有则返回 null。 */
  private async latestSpeculative(ticketId: string): Promise<Artifact | null> {
    const latest = await this.artifactsRepository.findLatest(
      ticketId,
      'breakdown',
    );
    if (latest?.status !== 'draft') return null;
    const payload = latest.payload as { speculative?: unknown } | null;
    return payload?.speculative === true ? latest : null;
  }
}
