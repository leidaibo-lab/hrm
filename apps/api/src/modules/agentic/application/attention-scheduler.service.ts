import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type { Attention } from '../domain/attention.entity';
import type { MandateRepository } from '../domain/mandate.repository';
import { MANDATE_REPOSITORY } from '../domain/mandate.repository';
import { readEscalationOwner, readPolicyRules } from '../domain/policy.entity';
import {
  POLICY_REPOSITORY,
  type PolicyRepository,
} from '../domain/policy.repository';
import {
  TICKET_REPOSITORY,
  type TicketRepository,
} from '../domain/ticket.repository';
import { AttentionService } from './attention.service';
import { AttentionReminderService } from './attention-reminder.service';
import { StaleTicketService } from './stale-ticket.service';
import { ThreadNotifierService } from './thread-notifier.service';

/** 关注过期扫描间隔（毫秒）。 */
const TICK_INTERVAL_MS = 10_000;
/** 单次扫描上限。 */
const EXPIRE_LIMIT = 100;
/** 升级关注的答复期限：默认 24 小时。 */
const ESCALATION_DEADLINE_MS = 24 * 60 * 60 * 1000;

/**
 * 关注过期清理：由 worker 进程周期执行，避免 api 多实例重复。
 * 到期待答关注转 expired，不自动通过；非复查类关注过期时按策略升级到负责人。
 */
@Injectable()
export class AttentionSchedulerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AttentionSchedulerService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly attentions: AttentionService,
    private readonly staleTickets: StaleTicketService,
    private readonly reminders: AttentionReminderService,
    @Inject(TICKET_REPOSITORY) private readonly tickets: TicketRepository,
    @Inject(POLICY_REPOSITORY) private readonly policies: PolicyRepository,
    @Inject(MANDATE_REPOSITORY)
    private readonly mandates: MandateRepository,
    private readonly notifier: ThreadNotifierService,
  ) {}

  /** 启动周期扫描。 */
  onModuleInit(): void {
    this.timer = setInterval(() => void this.tick(), TICK_INTERVAL_MS);
    this.timer.unref();
  }

  /** 停止周期扫描。 */
  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** 执行一轮；上一轮未完成时跳过。 */
  async tick(now: Date = new Date()): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const expired = await this.attentions.expireDue(now, EXPIRE_LIMIT);
      if (expired.length > 0) await this.escalate(expired, now);
      await this.reminders.tick(now);
      const policy = await this.policies.findCurrent();
      if (readPolicyRules(policy?.rules).watchdogEnabled !== false)
        await this.staleTickets.scan(now);
    } catch (error) {
      this.logger.error(
        `关注过期扫描失败：${error instanceof Error ? error.message : '未知错误'}`,
      );
    } finally {
      this.running = false;
    }
  }

  /**
   * 过期关注升级：按策略负责人生成一条复查关注并落库等待对象。
   * 复查关注自身过期时只提醒不再升级，避免无限链式生成。
   */
  private async escalate(expired: Attention[], now: Date): Promise<void> {
    const policy = await this.policies.findCurrent();
    const rules = policy?.rules;

    for (const attention of expired) {
      const ticket = await this.tickets.findById(attention.ticketId);
      if (!ticket) continue;
      const mandate = await this.mandates.findById(ticket.mandateId);
      const owner = readEscalationOwner(rules, mandate?.sourceType) ?? null;

      if (attention.kind === 'review') {
        const assignee = attention.assignee;
        await this.notifier.notify(
          ticket.threadId,
          `待办已过期：${attention.question}${toMention(assignee)}`,
          `expired:${attention.id}`,
        );
        continue;
      }

      await this.attentions.ask({
        ticketId: attention.ticketId,
        kind: 'review',
        question: `待办已过期，请负责人处理：${attention.question}`,
        deadline: new Date(now.getTime() + ESCALATION_DEADLINE_MS),
        assignee: owner ?? mandate?.actorId ?? undefined,
        now,
      });
      await this.notifier.notify(
        ticket.threadId,
        `待办已过期，已升级${toMention(owner)}：${attention.question}`,
        `expired:${attention.id}`,
      );
    }
  }
}

/** 负责人存在时生成飞书 @ 片段。 */
function toMention(assignee: string | null): string {
  return assignee ? ` <at user_id="${assignee}"></at>` : '';
}
