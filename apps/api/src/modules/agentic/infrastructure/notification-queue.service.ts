import { Injectable } from '@nestjs/common';
import { QueueService } from '../../../platform/queue';
import {
  NOTIFICATION_QUEUE_NAME,
  type NotificationJob,
  type NotificationQueuePort,
} from '../domain/notification-queue.port';

/** 通知任务名。 */
const NOTIFICATION_JOB_NAME = 'notify';

/** 通知队列的 BullMQ 实现。 */
@Injectable()
export class NotificationQueueService implements NotificationQueuePort {
  constructor(private readonly queue: QueueService) {}

  /** 投递通知任务。 */
  async enqueue(job: NotificationJob): Promise<void> {
    await this.queue.enqueue(
      NOTIFICATION_QUEUE_NAME,
      NOTIFICATION_JOB_NAME,
      job,
      { jobId: job.idempotencyKey },
    );
  }
}
