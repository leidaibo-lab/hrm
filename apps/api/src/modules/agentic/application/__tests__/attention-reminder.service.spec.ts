import { describe, expect, it } from 'vitest';
import { Attention } from '../../domain/attention.entity';
import type { Ticket } from '../../domain/ticket.entity';
import type { TicketRepository } from '../../domain/ticket.repository';
import type { AttentionService } from '../attention.service';
import { AttentionReminderService } from '../attention-reminder.service';
import type { ThreadNotifierService } from '../thread-notifier.service';

const AT = new Date('2026-11-16T00:00:00.000Z');
const SOON = new Date(AT.getTime() + 6 * 60 * 60 * 1000);

class FakeAttentionService {
  constructor(private readonly rows: Attention[]) {}
  async listOpen(): Promise<Attention[]> {
    return this.rows;
  }
}

class FakeTicketRepository implements TicketRepository {
  async findById(): Promise<Ticket | null> {
    return {
      id: 'ticket-1',
      threadId: 'thread-1',
      isOpen: true,
    } as unknown as Ticket;
  }
  async findByMandateId(): Promise<Ticket | null> {
    return null;
  }
  async list(): Promise<Ticket[]> {
    return [];
  }
  async listByThread(): Promise<Ticket[]> {
    return [];
  }
  async save(): Promise<void> {}
}

class FakeNotifier {
  readonly jobs: Array<{ threadId: string; text: string }> = [];
  async notify(threadId: string, text: string): Promise<void> {
    this.jobs.push({ threadId, text });
  }
}

function attention(deadline: Date): Attention {
  return Attention.create({
    id: 'attention-1',
    ticketId: 'ticket-1',
    kind: 'clarify',
    question: '验收标准？',
    assignee: 'ou-owner',
    deadline,
    now: AT,
  });
}

function makeService(row: Attention): {
  service: AttentionReminderService;
  notifier: FakeNotifier;
} {
  const notifier = new FakeNotifier();
  return {
    service: new AttentionReminderService(
      new FakeAttentionService([row]) as unknown as AttentionService,
      notifier as unknown as ThreadNotifierService,
      new FakeTicketRepository(),
    ),
    notifier,
  };
}

describe('AttentionReminderService.tick', () => {
  it('截止前 12 小时内提醒一次', async () => {
    const { service, notifier } = makeService(attention(SOON));
    expect(await service.tick(AT)).toBe(1);
    expect(await service.tick(AT)).toBe(0);
    expect(notifier.jobs[0].threadId).toBe('thread-1');
    expect(notifier.jobs[0].text).toContain('待办即将到期');
  });

  it('窗口外不提醒', async () => {
    const { service, notifier } = makeService(
      attention(new Date(AT.getTime() + 24 * 60 * 60 * 1000)),
    );
    expect(await service.tick(AT)).toBe(0);
    expect(notifier.jobs).toHaveLength(0);
  });
});
