import { Injectable } from '@nestjs/common';
import { QueueService } from '../../../platform/queue';
import {
  BREAKDOWN_QUEUE_NAME,
  type BreakdownJob,
  type BreakdownQueuePort,
} from '../domain/breakdown-queue.port';

/** 拆解任务名。 */
const BREAKDOWN_JOB_NAME = 'breakdown';

/** 拆解队列的 BullMQ 实现。 */
@Injectable()
export class BreakdownQueueService implements BreakdownQueuePort {
  constructor(private readonly queue: QueueService) {}

  /** 投递拆解任务；jobId 按工单固定，重复投递由 BullMQ 去重。 */
  async enqueue(job: BreakdownJob): Promise<void> {
    await this.queue.enqueue(BREAKDOWN_QUEUE_NAME, BREAKDOWN_JOB_NAME, job, {
      jobId: `breakdown:${job.ticketId}`,
    });
  }
}
