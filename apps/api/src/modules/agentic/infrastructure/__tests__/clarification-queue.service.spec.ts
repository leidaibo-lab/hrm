import { describe, expect, it } from 'vitest';
import type { QueueService } from '../../../../platform/queue';
import { ClarificationQueueService } from '../clarification-queue.service';

class FakeQueueService {
  readonly calls: Array<{
    queue: string;
    job: string;
    data: unknown;
    options?: { jobId?: string };
  }> = [];

  async enqueue(
    queue: string,
    job: string,
    data: unknown,
    options?: { jobId?: string },
  ): Promise<string> {
    this.calls.push({ queue, job, data, options });
    return 'job-1';
  }
}

describe('ClarificationQueueService.enqueue', () => {
  it('按工单固定 jobId，重复投递由 BullMQ 去重', async () => {
    const queue = new FakeQueueService();
    const service = new ClarificationQueueService(
      queue as unknown as QueueService,
    );

    await service.enqueue({
      ticketId: 'ticket-1',
      threadId: 'thread-1',
      triggerIds: ['trigger-1'],
    });

    expect(queue.calls[0].queue).toBe('agentic-clarification');
    expect(queue.calls[0].options?.jobId).toBe('clarify:ticket-1');
  });
});
