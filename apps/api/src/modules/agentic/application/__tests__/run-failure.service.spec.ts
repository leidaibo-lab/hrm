import { describe, expect, it } from 'vitest';
import { Attention } from '../../domain/attention.entity';
import type { AttentionRepository } from '../../domain/attention.repository';
import type { MandateRepository } from '../../domain/mandate.repository';
import type { Policy } from '../../domain/policy.entity';
import type { PolicyRepository } from '../../domain/policy.repository';
import type { Ticket } from '../../domain/ticket.entity';
import type { TicketRepository } from '../../domain/ticket.repository';
import type { AttentionService } from '../attention.service';
import { RunFailureService } from '../run-failure.service';

const AT = new Date('2026-11-16T00:00:00.000Z');

class FakeAttentionService {
  readonly asked: Array<Parameters<AttentionService['ask']>[0]> = [];
  async ask(input: Parameters<AttentionService['ask']>[0]): Promise<Attention> {
    this.asked.push(input);
    return {} as Attention;
  }
}

function makeService(options?: { openReview?: boolean }): {
  service: RunFailureService;
  asked: FakeAttentionService;
} {
  const asked = new FakeAttentionService();
  const ticket = {
    id: 'ticket-1',
    isOpen: true,
    mandateId: 'mandate-1',
  } as Ticket;
  const service = new RunFailureService(
    { findById: async () => ticket } as unknown as TicketRepository,
    {
      findCurrent: async () =>
        ({ id: 'policy-1', version: 1, rules: {} }) as Policy,
    } as unknown as PolicyRepository,
    {
      findById: async () => ({ sourceType: 'lark' }),
    } as unknown as MandateRepository,
    {
      listOpenByTicket: async () =>
        options?.openReview ? [{ kind: 'review' } as Attention] : [],
    } as unknown as AttentionRepository,
    asked as unknown as AttentionService,
  );
  return { service, asked };
}

describe('RunFailureService.report', () => {
  it('写 review 关注并按策略负责人等待对象', async () => {
    const { service, asked } = makeService();

    await service.report({
      ticketId: 'ticket-1',
      role: 'clarify',
      error: '模型失败',
      now: AT,
    });

    expect(asked.asked).toHaveLength(1);
    expect(asked.asked[0]).toMatchObject({
      ticketId: 'ticket-1',
      kind: 'review',
      question: expect.stringContaining('clarify 运行失败'),
    });
    expect(asked.asked[0].deadline).toEqual(
      new Date(AT.getTime() + 24 * 3_600_000),
    );
  });

  it('已有未关闭 review 关注时不重复创建', async () => {
    const { service, asked } = makeService({ openReview: true });

    await service.report({
      ticketId: 'ticket-1',
      role: 'clarify',
      error: '模型失败',
      now: AT,
    });

    expect(asked.asked).toEqual([]);
  });
});
