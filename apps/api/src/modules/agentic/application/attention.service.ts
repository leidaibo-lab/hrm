import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { AttentionKind } from '../domain/attention.entity';
import { Attention } from '../domain/attention.entity';
import {
  ATTENTION_REPOSITORY,
  type AttentionRepository,
} from '../domain/attention.repository';
import {
  MANDATE_REPOSITORY,
  type MandateRepository,
} from '../domain/mandate.repository';
import { metrics } from '../domain/metrics.port';
import { readPolicyRules } from '../domain/policy.entity';
import {
  POLICY_REPOSITORY,
  type PolicyRepository,
} from '../domain/policy.repository';
import {
  TICKET_REPOSITORY,
  type TicketRepository,
} from '../domain/ticket.repository';

/** 发起关注的输入。 */
export interface AskAttentionInput {
  /** 所属工单主键。 */
  ticketId: string;
  /** 关注类型。 */
  kind: AttentionKind;
  /** 问题文本。 */
  question: string;
  /** 可选答案。 */
  options?: unknown[] | null;
  /** 截止时间；缺省为当前时间 + 72 小时。 */
  deadline?: Date;
  /** 等待对象；缺省时按工单授权发起人回填。 */
  assignee?: string;
  /** 当前时间；缺省为系统时间。 */
  now?: Date;
}

/** 关注默认答复期限：72 小时。 */
const DEFAULT_DEADLINE_MS = 72 * 60 * 60 * 1000;

/** 关注用例：发起、回答与过期清理。 */
@Injectable()
export class AttentionService {
  constructor(
    @Inject(ATTENTION_REPOSITORY)
    private readonly attentions: AttentionRepository,
    @Optional()
    @Inject(POLICY_REPOSITORY)
    private readonly policies?: PolicyRepository,
    @Optional()
    @Inject(TICKET_REPOSITORY)
    private readonly tickets?: TicketRepository,
    @Optional()
    @Inject(MANDATE_REPOSITORY)
    private readonly mandates?: MandateRepository,
  ) {}

  /** 发起一条待答关注；等待对象与时限必有值。 */
  async ask(input: AskAttentionInput): Promise<Attention> {
    const now = input.now ?? new Date();
    const attention = Attention.create({
      id: randomUUID(),
      ticketId: input.ticketId,
      kind: input.kind,
      question: input.question,
      options: input.options,
      deadline: input.deadline ?? new Date(now.getTime() + DEFAULT_DEADLINE_MS),
      assignee: await this.resolveAssignee(input.ticketId, input.assignee),
      now,
    });
    await this.attentions.save(attention);
    metrics.increment('agentic_events_total', { event: 'attention_raised' });
    return attention;
  }

  /**
   * 出站永久失败时的降级通知：给工单负责人建 72h 复查关注。
   * 同一工单已有同类未决关注时返回 null，避免重复打扰。
   */
  async raiseOutboundFailure(
    ticketId: string,
    reason: string,
    now: Date = new Date(),
  ): Promise<Attention | null> {
    const open = await this.attentions.listOpen(200);
    if (
      open.some(
        (attention) =>
          attention.ticketId === ticketId &&
          attention.question.includes('出站消息永久失败'),
      )
    )
      return null;
    const policy = await this.policies?.findCurrent();
    const rules = policy ? readPolicyRules(policy.rules) : {};
    return this.ask({
      ticketId,
      kind: 'review',
      question: `出站消息永久失败：${reason}。请检查来源配置后补发。`,
      deadline: new Date(now.getTime() + 72 * 60 * 60 * 1000),
      assignee: rules.escalationOwner,
      now,
    });
  }

  /** 按主键取关注；不存在返回 null。 */
  async findById(id: string): Promise<Attention | null> {
    return this.attentions.findById(id);
  }

  /** 列出待答关注。 */
  async listOpen(limit = 50): Promise<Attention[]> {
    return this.attentions.listOpen(limit);
  }

  /** 回答问题；已关闭或过期时报错。 */
  async answer(
    id: string,
    answer: unknown,
    decidedBy: string,
    now: Date = new Date(),
  ): Promise<Attention> {
    const attention = await this.load(id);
    attention.answerWith(answer, decidedBy, now);
    await this.attentions.save(attention);
    return attention;
  }

  /** 把已过截止时间的待答关注标记为过期，返回过期关注。 */
  async expireDue(now: Date = new Date(), limit = 100): Promise<Attention[]> {
    const open = await this.attentions.listOpen(limit);
    const expired: Attention[] = [];
    for (const attention of open) {
      if (attention.deadline > now) continue;
      attention.expire(now);
      await this.attentions.save(attention);
      expired.push(attention);
    }
    return expired;
  }

  /**
   * 解析等待对象：显式值优先；否则回落到工单授权发起人。
   * 仍为空时拒绝创建，避免产生无人承接的等待对象。
   */
  private async resolveAssignee(
    ticketId: string,
    explicit?: string,
  ): Promise<string> {
    const trimmed = explicit?.trim();
    if (trimmed) return trimmed;
    const ticket = await this.tickets?.findById(ticketId);
    const mandate =
      ticket && this.mandates
        ? await this.mandates.findById(ticket.mandateId)
        : null;
    if (mandate?.actorId.trim()) return mandate.actorId;
    throw new Error(`关注缺少等待对象，且工单无授权发起人：${ticketId}`);
  }

  private async load(id: string): Promise<Attention> {
    const attention = await this.attentions.findById(id);
    if (!attention) throw new Error(`关注不存在：${id}`);
    return attention;
  }
}
