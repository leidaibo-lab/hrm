import { describe, expect, it } from 'vitest';
import type { OutboundMessage } from '../../domain/outbound-message.entity';
import type { OutboundMessageRepository } from '../../domain/outbound-message.repository';
import { OutboundService } from '../outbound.service';

const AT = new Date('2026-11-16T00:00:00.000Z');

class FakeOutboundMessageRepository implements OutboundMessageRepository {
  readonly rows = new Map<string, OutboundMessage>();

  async findById(id: string): Promise<OutboundMessage | null> {
    return this.rows.get(id) ?? null;
  }

  async findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<OutboundMessage | null> {
    for (const message of this.rows.values()) {
      if (message.idempotencyKey === idempotencyKey) return message;
    }
    return null;
  }

  async listDue(at: Date, limit: number): Promise<OutboundMessage[]> {
    return [...this.rows.values()]
      .filter((message) => message.isDue(at))
      .slice(0, limit);
  }

  async save(message: OutboundMessage): Promise<void> {
    this.rows.set(message.id, message);
  }
}

function makeService(): {
  service: OutboundService;
  repository: FakeOutboundMessageRepository;
} {
  const repository = new FakeOutboundMessageRepository();
  return { service: new OutboundService(repository), repository };
}

const input = {
  instanceId: 'instance-1',
  address: { chatId: 'chat-1' },
  payload: { text: '已收到' },
  idempotencyKey: 'reply:thread-1:1',
  now: AT,
};

describe('OutboundService', () => {
  it('入队后为待发', async () => {
    const { service, repository } = makeService();
    const result = await service.enqueue(input);
    expect(result.created).toBe(true);
    expect(result.message.status).toBe('pending');
    expect(repository.rows.size).toBe(1);
  });

  it('同一幂等键重复入队返回原消息', async () => {
    const { service, repository } = makeService();
    const first = await service.enqueue(input);
    const second = await service.enqueue(input);
    expect(second.created).toBe(false);
    expect(second.message.id).toBe(first.message.id);
    expect(repository.rows.size).toBe(1);
  });

  it('首次失败按 30 秒退避', async () => {
    const { service, repository } = makeService();
    const { message } = await service.enqueue(input);

    await service.recordFailure(message.id, 'timeout', AT);

    const saved = repository.rows.get(message.id);
    expect(saved?.attempts).toBe(1);
    expect(saved?.nextAttemptAt?.toISOString()).toBe(
      '2026-11-16T00:00:30.000Z',
    );
  });

  it('达到最大尝试次数转永久失败', async () => {
    const { service, repository } = makeService();
    const { message } = await service.enqueue(input);

    for (let index = 0; index < 5; index += 1)
      await service.recordFailure(message.id, 'timeout', AT);

    expect(repository.rows.get(message.id)?.status).toBe('gone');
  });

  it('发送成功记录 sentAt', async () => {
    const { service, repository } = makeService();
    const { message } = await service.enqueue(input);

    await service.recordSent(message.id, AT);

    expect(repository.rows.get(message.id)?.status).toBe('sent');
    expect(repository.rows.get(message.id)?.sentAt).toEqual(AT);
  });
});
