import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import type { Artifact, ArtifactKind } from '../domain/artifact.entity';
import {
  ARTIFACT_REPOSITORY,
  type ArtifactRepository,
} from '../domain/artifact.repository';
import type { Attention } from '../domain/attention.entity';
import { AttentionStateError } from '../domain/attention.error';
import {
  ATTENTION_REPOSITORY,
  type AttentionRepository,
} from '../domain/attention.repository';
import {
  BREAKDOWN_QUEUE,
  type BreakdownQueuePort,
} from '../domain/breakdown-queue.port';
import { metrics } from '../domain/metrics.port';
import {
  TICKET_REPOSITORY,
  type TicketRepository,
} from '../domain/ticket.repository';
import { TICKET_LOCK, type TicketLockPort } from '../domain/ticket-lock.port';
import { ArtifactService } from './artifact.service';
import { AttentionService } from './attention.service';
import { BreakdownService } from './breakdown.service';
import { ThreadNotifierService } from './thread-notifier.service';
import { WritebackService } from './writeback.service';

/** 撤销字段回填的结果。 */
export interface RevokeWritebackResult {
  /** 撤销后追加的产物版本。 */
  artifact: Artifact;
  /** 已写回的上一版本字段。 */
  fields: Record<string, unknown>;
}

/**
 * 人工闸门编排：同一工单的澄清问题全部回答后，确认最新澄清稿。
 * 有任一问题未答时保持草稿；不自动通过。
 */
@Injectable()
export class GateService {
  private readonly logger = new Logger(GateService.name);
  /** 按工单排队回答：answer + 闸门推进在同一串行段内完成。 */
  private readonly answerLocks = new Map<string, Promise<void>>();

  constructor(
    @Inject(ATTENTION_REPOSITORY)
    private readonly attentions: AttentionRepository,
    @Inject(ARTIFACT_REPOSITORY)
    private readonly artifacts: ArtifactRepository,
    private readonly artifactService: ArtifactService,
    @Inject(TICKET_REPOSITORY) private readonly tickets: TicketRepository,
    private readonly notifier: ThreadNotifierService,
    private readonly writeback: WritebackService,
    @Inject(BREAKDOWN_QUEUE)
    private readonly breakdownQueue: BreakdownQueuePort,
    private readonly breakdown: BreakdownService,
    private readonly attentionService: AttentionService,
    @Inject(TICKET_LOCK) private readonly ticketLock: TicketLockPort,
  ) {}

  /** 回答并推进闸门：同一工单串行，避免并发回答同时进入 finalize。 */
  async answerAttention(
    id: string,
    answer: unknown,
    decision: 'confirm' | 'modify' | 'reject',
    reason: string | undefined,
    decidedBy: string,
  ): Promise<Attention> {
    const existing = await this.attentions.findById(id);
    if (!existing) throw new Error(`关注不存在：${id}`);
    const ticketId = existing.ticketId;
    // 跨副本互斥：同一工单同时只允许一条回答进入 answer + 闸门推进。
    const handle = await this.ticketLock.acquire(ticketId);
    if (!handle)
      throw new ConflictException('该工单正在处理另一条回答，请稍后重试');
    try {
      return await this.answerWithLocalQueue(
        id,
        ticketId,
        answer,
        decision,
        reason,
        decidedBy,
      );
    } catch (error) {
      if (error instanceof AttentionStateError)
        throw new ConflictException(error.message);
      throw error;
    } finally {
      await handle.release();
    }
  }

  /** 同实例内按工单排队，避免并发回答同时进入 finalize。 */
  private async answerWithLocalQueue(
    id: string,
    ticketId: string,
    answer: unknown,
    decision: 'confirm' | 'modify' | 'reject',
    reason: string | undefined,
    decidedBy: string,
  ): Promise<Attention> {
    const previous = this.answerLocks.get(ticketId) ?? Promise.resolve();
    const current = previous
      .catch(() => undefined)
      .then(async () => {
        const attention = await this.attentionService.answer(
          id,
          { decision, value: answer },
          decidedBy,
        );
        await this.onAttentionAnswered(
          ticketId,
          decision,
          reason,
          typeof answer === 'string' ? answer : JSON.stringify(answer),
        );
        return attention;
      });
    const tail = current.then(
      () => undefined,
      () => undefined,
    );
    this.answerLocks.set(ticketId, tail);
    try {
      return await current;
    } finally {
      if (this.answerLocks.get(ticketId) === tail)
        this.answerLocks.delete(ticketId);
    }
  }

  /** 回答后按决定类型推进闸门。 */
  async onAttentionAnswered(
    ticketId: string,
    decision: 'confirm' | 'modify' | 'reject' = 'confirm',
    reason?: string,
    answer?: string,
  ): Promise<void> {
    if (decision === 'reject') {
      const ticket = await this.tickets.findById(ticketId);
      if (!ticket?.isOpen) return;
      await this.breakdown.discardSpeculative(ticketId);
      const rejectedReason = reason?.trim() || '澄清被驳回';
      ticket.end(rejectedReason, new Date());
      await this.tickets.save(ticket);
      metrics.increment('agentic_events_total', { event: 'ticket_ended' });
      await this.notifier.notify(
        ticket.threadId,
        `需求已驳回：${rejectedReason}`,
        `gate:${ticketId}:reject`,
      );
      return;
    }
    const open = await this.attentions.listOpenByTicket(ticketId);
    if (open.length > 0) return;

    const latest = await this.artifacts.findLatest(ticketId, 'clarify');
    if (latest?.status !== 'draft') {
      await this.confirmBreakdown(ticketId);
      return;
    }

    if (decision === 'modify') {
      const payload =
        latest.payload && typeof latest.payload === 'object'
          ? (latest.payload as Record<string, unknown>)
          : {};
      const revised = await this.artifactService.publish({
        ticketId,
        kind: 'clarify',
        payload: {
          ...payload,
          revision: answer?.trim() || reason?.trim() || '人工修改',
        },
        assignmentId: latest.assignmentId,
      });
      await this.artifactService.confirm(revised.id);
      await this.artifactService.supersede(latest.id);
      await this.breakdown.discardSpeculative(ticketId);
      await this.finalize(ticketId, revised);
      return;
    }

    await this.artifactService.confirm(latest.id);
    await this.finalize(ticketId, latest);
  }

  /**
   * 撤销已确认产物的字段回填：以上一版本内容追加新版本并重新写回。
   * 版本链只追加，撤销动作本身可回放；无上一版本或最新稿未确认时拒绝。
   */
  async revokeWriteback(
    ticketId: string,
    kind: ArtifactKind = 'clarify',
  ): Promise<RevokeWritebackResult> {
    const ticket = await this.tickets.findById(ticketId);
    if (!ticket) throw new Error(`工单不存在：${ticketId}`);
    if (!ticket.isOpen) throw new Error('已结束工单不能撤销回填');

    const chain = (await this.artifacts.listByTicket(ticketId))
      .filter((artifact) => artifact.kind === kind)
      .sort((left, right) => right.version - left.version);
    const [latest, previous] = chain;
    if (!latest || !previous) throw new Error('没有可撤销的回填版本');
    if (latest.status !== 'confirmed')
      throw new Error('最新产物未确认，不能撤销回填');

    const restored = await this.artifactService.publish({
      ticketId,
      kind,
      payload: previous.payload,
      assignmentId: latest.assignmentId,
    });
    await this.artifactService.confirm(restored.id);
    await this.artifactService.supersede(latest.id);
    const written = await this.writeback.writeback(
      ticket.threadId,
      ticketId,
      restored,
    );
    await this.notifier.notify(
      ticket.threadId,
      `已撤销上次字段回填，恢复至 v${previous.version}。`,
      `revoke:${ticketId}:${restored.id}`,
    );
    return { artifact: restored, fields: written.fields };
  }

  private async finalize(ticketId: string, artifact: Artifact): Promise<void> {
    const ticket = await this.tickets.findById(ticketId);
    if (!ticket) return;
    const written = await this.writeback.writeback(
      ticket.threadId,
      ticketId,
      artifact,
    );
    if (Object.keys(written.fields).length === 0)
      await this.notifier.notify(
        ticket.threadId,
        '澄清稿已确认，agentic 将进入下一步。',
        `gate:${ticketId}:confirm`,
      );
    try {
      const delivered = await this.breakdown.deliverSpeculative(ticketId);
      if (!delivered)
        await this.breakdownQueue.enqueue({
          ticketId,
          threadId: ticket.threadId,
          triggerIds: [],
        });
    } catch (error) {
      this.logger.warn(
        `拆解任务投递失败：${
          error instanceof Error ? error.message : '未知错误'
        }`,
      );
    }
  }

  /** 确认最新拆解稿；无草稿或工单已结束时跳过。 */
  private async confirmBreakdown(ticketId: string): Promise<void> {
    const latest = await this.artifacts.findLatest(ticketId, 'breakdown');
    if (latest?.status !== 'draft') return;
    const ticket = await this.tickets.findById(ticketId);
    if (!ticket?.isOpen) return;
    await this.artifactService.confirm(latest.id);
    await this.notifier.notify(
      ticket.threadId,
      '拆解稿已确认，可开始排期。',
      `gate:${ticketId}:breakdown`,
    );
  }
}
