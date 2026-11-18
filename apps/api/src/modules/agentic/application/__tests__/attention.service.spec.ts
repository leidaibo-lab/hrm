import { describe, expect, it } from 'vitest';
import type { Attention } from '../../domain/attention.entity';
import type { AttentionRepository } from '../../domain/attention.repository';
import { AttentionService } from '../attention.service';

const AT = new Date('2026-11-16T00:00:00.000Z');
const LATER = new Date('2026-11-16T01:00:00.000Z');

class FakeAttentionRepository implements AttentionRepository {
  readonly rows = new Map<string, Attention>();

  async findById(id: string): Promise<Attention | null> {
    return this.rows.get(id) ?? null;
  }
  async listOpenByTicket(ticketId: string): Promise<Attention[]> {
    return [...this.rows.values()].filter(
      (attention) =>
        attention.ticketId === ticketId && attention.status === 'open',
    );
  }
  async listOpen(limit: number): Promise<Attention[]> {
    return [...this.rows.values()]
      .filter((attention) => attention.status === 'open')
      .slice(0, limit);
  }
  async listByTicket(): Promise<Attention[]> {
    return [];
  }

  async save(attention: Attention): Promise<void> {
    this.rows.set(attention.id, attention);
  }
}

function makeService(): {
  service: AttentionService;
  repository: FakeAttentionRepository;
} {
  const repository = new FakeAttentionRepository();
  return { service: new AttentionService(repository), repository };
}

describe('AttentionService', () => {
  it('发起关注后落库为待答', async () => {
    const { service, repository } = makeService();
    const attention = await service.ask({
      ticketId: 'ticket-1',
      kind: 'clarify',
      question: '验收标准？',
      assignee: 'ou-owner',
      deadline: new Date(AT.getTime() + 3_600_000),
      now: AT,
    });
    expect(attention.status).toBe('open');
    expect(repository.rows.size).toBe(1);
  });

  it('回答后状态为 answered', async () => {
    const { service } = makeService();
    const attention = await service.ask({
      ticketId: 'ticket-1',
      kind: 'confirm',
      question: '是否开工？',
      assignee: 'ou-owner',
      deadline: new Date(AT.getTime() + 2 * 3_600_000),
      now: AT,
    });

    const answered = await service.answer(attention.id, 'yes', 'user-1', LATER);

    expect(answered.status).toBe('answered');
    expect(answered.answer).toBe('yes');
  });

  it('过期清理只处理已到截止时间的关注', async () => {
    const { service, repository } = makeService();
    await service.ask({
      ticketId: 'ticket-1',
      kind: 'clarify',
      question: '过期问题',
      assignee: 'ou-owner',
      deadline: AT,
      now: AT,
    });
    await service.ask({
      ticketId: 'ticket-1',
      kind: 'clarify',
      question: '未过期问题',
      assignee: 'ou-owner',
      deadline: new Date('2026-11-16T02:00:00.000Z'),
      now: AT,
    });

    const expired = await service.expireDue(LATER, 10);

    expect(expired).toHaveLength(1);
    expect(
      [...repository.rows.values()].filter(
        (attention) => attention.status === 'expired',
      ),
    ).toHaveLength(1);
  });

  it('发起关注时记录等待对象', async () => {
    const { service } = makeService();
    const attention = await service.ask({
      ticketId: 'ticket-1',
      kind: 'review',
      question: '请负责人处理',
      assignee: 'ou-owner',
      now: AT,
    });

    expect(attention.assignee).toBe('ou-owner');
  });

  it('未指定等待对象时回落到工单授权发起人', async () => {
    const repository = new FakeAttentionRepository();
    const service = new AttentionService(
      repository,
      undefined,
      {
        findById: async () => ({ id: 'ticket-1', mandateId: 'mandate-1' }),
      } as never,
      {
        findById: async () => ({ actorId: 'ou-mandate' }),
      } as never,
    );

    const attention = await service.ask({
      ticketId: 'ticket-1',
      kind: 'clarify',
      question: '需要等待谁？',
      now: AT,
    });

    expect(attention.assignee).toBe('ou-mandate');
    expect(attention.deadline.getTime()).toBe(
      AT.getTime() + 72 * 60 * 60 * 1000,
    );
  });

  it('既无等待对象也无授权发起人时拒绝创建', async () => {
    const { service } = makeService();
    await expect(
      service.ask({
        ticketId: 'ticket-1',
        kind: 'clarify',
        question: '没人接的问题',
        now: AT,
      }),
    ).rejects.toThrow('关注缺少等待对象');
  });

  it('关注不存在时报错', async () => {
    const { service } = makeService();
    await expect(service.answer('missing', 'yes', 'user-1')).rejects.toThrow(
      '关注不存在',
    );
  });
});
