import { Injectable } from '@nestjs/common';
import { QueueService } from '../../../platform/queue';
import {
  CLARIFICATION_QUEUE_NAME,
  type ClarificationJob,
  type ClarificationQueuePort,
} from '../domain/clarification-queue.port';

/** 澄清任务名。 */
const CLARIFICATION_JOB_NAME = 'clarify';

/** 澄清队列的 BullMQ 实现。 */
@Injectable()
export class ClarificationQueueService implements ClarificationQueuePort {
  constructor(private readonly queue: QueueService) {}

  /** 投递澄清任务；jobId 按工单固定，重复投递由 BullMQ 去重。 */
  async enqueue(job: ClarificationJob): Promise<void> {
    await this.queue.enqueue(
      CLARIFICATION_QUEUE_NAME,
      CLARIFICATION_JOB_NAME,
      job,
      {
        jobId: `clarify:${job.ticketId}`,
        attempts: 2,
        backoff: { type: 'exponential', delay: 5_000 },
      },
    );
  }
}
