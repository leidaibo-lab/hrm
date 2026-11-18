import { Inject, Injectable } from '@nestjs/common';
import {
  TICKET_REPOSITORY,
  type TicketRepository,
} from '../domain/ticket.repository';
import { AttentionService } from './attention.service';
import { ThreadNotifierService } from './thread-notifier.service';

/** 提醒窗口：截止前 12 小时。 */
const WINDOW_MS = 12 * 60 * 60 * 1000;

/** 关注到期前提醒：进程内去重，避免每轮重复发送。 */
@Injectable()
export class AttentionReminderService {
  private readonly reminded = new Set<string>();

  constructor(
    private readonly attentions: AttentionService,
    private readonly notifier: ThreadNotifierService,
    @Inject(TICKET_REPOSITORY) private readonly tickets: TicketRepository,
  ) {}

  /** 扫描并提醒即将到期的关注，返回发送条数。 */
  async tick(
    now: Date = new Date(),
    windowMs: number = WINDOW_MS,
  ): Promise<number> {
    const open = await this.attentions.listOpen(100);
    let sent = 0;
    for (const attention of open) {
      if (attention.deadline <= now) continue;
      if (attention.deadline.getTime() > now.getTime() + windowMs) continue;
      if (this.reminded.has(attention.id)) continue;

      const ticket = await this.tickets.findById(attention.ticketId);
      if (!ticket) continue;
      await this.notifier.notify(
        ticket.threadId,
        `待办即将到期：${attention.question}`,
        `remind:${attention.id}`,
      );
      this.reminded.add(attention.id);
      sent += 1;
    }
    return sent;
  }
}
