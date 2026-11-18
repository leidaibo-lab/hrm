import { describe, expect, it } from 'vitest';
import type { QueueService } from '../../../../platform/queue';
import { NotificationWorkerService } from '../notification-worker.service';
import type { OutboundService } from '../outbound.service';

class FakeOutboundService {
  readonly jobs: Array<{
    instanceId: string;
    address: unknown;
    payload: unknown;
    idempotencyKey: string;
  }> = [];

  async enqueue(job: {
    instanceId: string;
    address: unknown;
    payload: unknown;
    idempotencyKey: string;
  }): Promise<unknown> {
    this.jobs.push(job);
    return {};
  }
}

describe('NotificationWorkerService.handle', () => {
  it('把通知转为出站消息', async () => {
    const outbound = new FakeOutboundService();
    const service = new NotificationWorkerService(
      {} as QueueService,
      outbound as unknown as OutboundService,
    );

    await service.handle({
      instanceId: 'instance-1',
      chatId: 'chat-1',
      text: '澄清稿已确认',
      idempotencyKey: 'gate:ticket-1:confirm',
    });

    expect(outbound.jobs).toHaveLength(1);
    expect(outbound.jobs[0]).toEqual({
      instanceId: 'instance-1',
      address: { chatId: 'chat-1' },
      payload: { text: '澄清稿已确认' },
      idempotencyKey: 'gate:ticket-1:confirm',
    });
  });

  it('字段写回转成 Bitable 出站消息', async () => {
    const outbound = new FakeOutboundService();
    const service = new NotificationWorkerService(
      {} as QueueService,
      outbound as unknown as OutboundService,
    );

    await service.handle({
      instanceId: 'instance-1',
      bitable: {
        appToken: 'app',
        tableId: 'table',
        recordId: 'record',
        fields: { title: '导出' },
      },
      idempotencyKey: 'writeback:ticket-1:artifact-1',
    });

    expect(outbound.jobs[0].address).toEqual({
      appToken: 'app',
      tableId: 'table',
      recordId: 'record',
    });
    expect(outbound.jobs[0].payload).toEqual({
      kind: 'fields',
      fields: { title: '导出' },
    });
  });
});
