import { Inject, Injectable } from '@nestjs/common';
import {
  NOTIFICATION_QUEUE,
  type NotificationQueuePort,
} from '../domain/notification-queue.port';
import {
  THREAD_REPOSITORY,
  type ThreadRepository,
} from '../domain/thread.repository';
import {
  TICKET_REPOSITORY,
  type TicketRepository,
} from '../domain/ticket.repository';
import type { Trigger } from '../domain/trigger.entity';
import {
  TRIGGER_REPOSITORY,
  type TriggerRepository,
} from '../domain/trigger.repository';

/** 线程通知：把文本发回来源线程，地址与实例从线程/事件推导。 */
@Injectable()
export class ThreadNotifierService {
  constructor(
    @Inject(THREAD_REPOSITORY) private readonly threads: ThreadRepository,
    @Inject(TRIGGER_REPOSITORY)
    private readonly triggers: TriggerRepository,
    @Inject(NOTIFICATION_QUEUE)
    private readonly notifications: NotificationQueuePort,
    @Inject(TICKET_REPOSITORY)
    private readonly tickets: TicketRepository,
  ) {}

  /** 写回多维表格字段；缺少记录定位时返回 false。 */
  async notifyFields(
    threadId: string,
    fields: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<boolean> {
    const target = await this.target(threadId);
    if (!target) return false;
    const payload = target.trigger.payload as {
      app_token?: unknown;
      table_id?: unknown;
      record_id?: unknown;
    };
    if (
      typeof payload.app_token !== 'string' ||
      typeof payload.table_id !== 'string' ||
      typeof payload.record_id !== 'string'
    )
      return false;

    await this.notifications.enqueue({
      instanceId: target.instanceId,
      ticketId: await this.openTicketId(threadId),
      bitable: {
        appToken: payload.app_token,
        tableId: payload.table_id,
        recordId: payload.record_id,
        fields,
      },
      idempotencyKey,
    });
    return true;
  }

  /** 发送通知；线程无会话标识或无事件来源时静默跳过。 */
  async notify(
    threadId: string,
    text: string,
    idempotencyKey: string,
  ): Promise<void> {
    const target = await this.target(threadId);
    if (!target?.chatId) return;
    await this.notifications.enqueue({
      instanceId: target.instanceId,
      ticketId: await this.openTicketId(threadId),
      chatId: target.chatId,
      text,
      idempotencyKey,
    });
  }

  /** 线程当前进行中工单；不存在时返回 undefined。 */
  private async openTicketId(threadId: string): Promise<string | undefined> {
    const tickets = await this.tickets.listByThread(threadId);
    return tickets.find((ticket) => ticket.isOpen)?.id;
  }

  private async target(threadId: string): Promise<{
    instanceId: string;
    chatId: string | null;
    trigger: Trigger;
  } | null> {
    const thread = await this.threads.findById(threadId);
    if (!thread?.scopeKey) return null;
    const triggers = await this.triggers.listByThread(thread.id, 1);
    const trigger = triggers[0];
    if (!trigger) return null;
    return {
      instanceId: trigger.instanceId,
      chatId: thread.scopeKey,
      trigger,
    };
  }
}
