import { AGENTIC_QUEUE } from '@cip/shared';
import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { QueueService } from '../../../platform/queue';
import { OutboundService } from './outbound.service';

/** 通知任务负载：与 agentic NotificationJob 契约一致。 */
interface NotificationJobData {
  /** 来源实例主键。 */
  instanceId: string;
  /** 会话标识。 */
  chatId?: string;
  /** 文本内容。 */
  text?: string;
  /** 字段写回目标。 */
  bitable?: {
    appToken: string;
    tableId: string;
    recordId: string;
    fields: Record<string, unknown>;
  };
  /** 关联工单主键。 */
  ticketId?: string;
  /** 幂等键。 */
  idempotencyKey: string;
}

/** 通知任务消费者：把闸门结果转成出站消息入队。 */
@Injectable()
export class NotificationWorkerService
  implements OnModuleInit, OnModuleDestroy
{
  private worker: ReturnType<QueueService['createWorker']> | null = null;

  constructor(
    private readonly queue: QueueService,
    private readonly outbound: OutboundService,
  ) {}

  /** 注册消费者。 */
  onModuleInit(): void {
    this.worker = this.queue.createWorker<NotificationJobData>(
      AGENTIC_QUEUE.notification,
      (job) => this.handle(job.data),
      2,
    );
  }

  /** 关闭消费者。 */
  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  /** 入队一条出站消息：字段写回或文本。 */
  async handle(job: NotificationJobData): Promise<void> {
    if (job.bitable) {
      await this.outbound.enqueue({
        instanceId: job.instanceId,
        address: {
          appToken: job.bitable.appToken,
          tableId: job.bitable.tableId,
          recordId: job.bitable.recordId,
        },
        payload: {
          kind: 'fields',
          fields: job.bitable.fields,
          ...(job.ticketId ? { ticketId: job.ticketId } : {}),
        },
        idempotencyKey: job.idempotencyKey,
      });
      return;
    }
    if (!job.chatId || !job.text) return;
    await this.outbound.enqueue({
      instanceId: job.instanceId,
      address: { chatId: job.chatId },
      payload: {
        text: job.text,
        ...(job.ticketId ? { ticketId: job.ticketId } : {}),
      },
      idempotencyKey: job.idempotencyKey,
    });
  }
}
