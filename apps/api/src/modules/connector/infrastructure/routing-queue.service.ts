import { Injectable } from '@nestjs/common';
import { QueueService } from '../../../platform/queue';
import {
  ROUTING_QUEUE_NAME,
  type RoutingJob,
  type RoutingQueuePort,
} from '../domain/routing-queue.port';

/** 路由任务名。 */
const ROUTING_JOB_NAME = 'route';

/** 事件路由队列的 BullMQ 实现。 */
@Injectable()
export class RoutingQueueService implements RoutingQueuePort {
  constructor(private readonly queue: QueueService) {}

  /** 投递路由任务；jobId 按事件固定，重复投递由 BullMQ 去重。 */
  async enqueue(job: RoutingJob): Promise<void> {
    await this.queue.enqueue(ROUTING_QUEUE_NAME, ROUTING_JOB_NAME, job, {
      jobId: `route:${job.triggerId}`,
      attempts: 2,
      backoff: { type: 'exponential', delay: 5_000 },
    });
  }
}
