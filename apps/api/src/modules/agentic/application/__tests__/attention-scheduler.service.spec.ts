import { describe, expect, it } from 'vitest';
import type { Attention } from '../../domain/attention.entity';
import { Mandate } from '../../domain/mandate.entity';
import type { MandateRepository } from '../../domain/mandate.repository';
import { Policy } from '../../domain/policy.entity';
import type { PolicyRepository } from '../../domain/policy.repository';
import type { Ticket } from '../../domain/ticket.entity';
import type { TicketRepository } from '../../domain/ticket.repository';
import type { AttentionService } from '../attention.service';
import type { AttentionReminderService } from '../attention-reminder.service';
import { AttentionSchedulerService } from '../attention-scheduler.service';
import type { StaleTicketService } from '../stale-ticket.service';
import type { ThreadNotifierService } from '../thread-notifier.service';

const AT = new Date('2026-11-16T00:00:00.000Z');

/** 关注发起入参：仅断言用到的字段。 */
interface AskInput {
  /** 所属工单主键。 */
  ticketId: string;
  /** 关注类型。 */
  kind: string;
  /** 问题文本。 */
  question: string;
  /** 截止时间。 */
  deadline?: Date | null;
  /** 等待对象。 */
  assignee?: string | null;
  /** 当前时间。 */
  now?: Date;
}

class FakeStaleTicketService {
  calls = 0;

  async scan(): Promise<number> {
    this.calls += 1;
    return 0;
  }
}

class FakeTicketRepository implements TicketRepository {
  async findById(): Promise<Ticket | null> {
    return {
      id: 'ticket-1',
      threadId: 'thread-1',
      mandateId: 'mandate-1',
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

class FakeMandateRepository implements MandateRepository {
  async findById(): Promise<Mandate | null> {
    return Mandate.create({
      id: 'mandate-1',
      policyId: 'policy-1',
      policyVersion: 1,
      strength: 'explicit',
      scope: {},
      actorId: 'actor-1',
      sourceType: 'lark',
      now: AT,
    });
  }
  async create(): Promise<void> {}
}

class FakePolicyRepository implements PolicyRepository {
  constructor(private readonly rules: Record<string, unknown> | null) {}

  async findById(): Promise<Policy | null> {
    return this.policy();
  }
  async findCurrent(): Promise<Policy | null> {
    return this.policy();
  }
  async findByVersion(): Promise<Policy | null> {
    return this.policy();
  }
  async create(): Promise<void> {}

  private policy(): Policy | null {
    if (!this.rules) return null;
    return Policy.create({
      id: 'policy-1',
      version: 1,
      acceptMode: 'explicit',
      rules: this.rules,
      createdBy: 'admin',
      now: AT,
    });
  }
}

class FakeNotifier {
  readonly jobs: Array<{ threadId: string; text: string }> = [];
  async notify(threadId: string, text: string): Promise<void> {
    this.jobs.push({ threadId, text });
  }
}

class FakeReminderService {
  calls = 0;
  async tick(): Promise<number> {
    this.calls += 1;
    return 0;
  }
}

class FakeAttentionService {
  calls = 0;
  error: Error | null = null;
  gate: Promise<void> | null = null;

  expired: Attention[] = [];
  readonly asked: AskInput[] = [];

  async ask(input: AskInput): Promise<Attention> {
    this.asked.push(input);
    return { id: `attention-${this.asked.length}` } as unknown as Attention;
  }

  async expireDue(): Promise<Attention[]> {
    this.calls += 1;
    if (this.gate) await this.gate;
    if (this.error) throw this.error;
    return this.expired;
  }
}

function makeScheduler(rules: Record<string, unknown> | null = null): {
  scheduler: AttentionSchedulerService;
  attentions: FakeAttentionService;
  stale: FakeStaleTicketService;
  reminders: FakeReminderService;
  notifier: FakeNotifier;
} {
  const attentions = new FakeAttentionService();
  const stale = new FakeStaleTicketService();
  const reminders = new FakeReminderService();
  const notifier = new FakeNotifier();
  return {
    scheduler: new AttentionSchedulerService(
      attentions as unknown as AttentionService,
      stale as unknown as StaleTicketService,
      reminders as unknown as AttentionReminderService,
      new FakeTicketRepository(),
      new FakePolicyRepository(rules) as unknown as PolicyRepository,
      new FakeMandateRepository() as unknown as MandateRepository,
      notifier as unknown as ThreadNotifierService,
    ),
    attentions,
    stale,
    reminders,
    notifier,
  };
}

function expiredAttention(overrides: Partial<Attention> = {}): Attention {
  return {
    id: 'attention-1',
    ticketId: 'ticket-1',
    kind: 'clarify',
    question: '验收标准？',
    assignee: null,
    ...overrides,
  } as unknown as Attention;
}

describe('AttentionSchedulerService.tick', () => {
  it('一轮执行一次过期清理', async () => {
    const { scheduler, attentions, stale, reminders } = makeScheduler();
    await scheduler.tick(AT);
    expect(attentions.calls).toBe(1);
    expect(stale.calls).toBe(1);
    expect(reminders.calls).toBe(1);
  });

  it('上一轮未结束时跳过', async () => {
    const { scheduler, attentions } = makeScheduler();
    let release: () => void = () => {};
    attentions.gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const first = scheduler.tick(AT);
    await scheduler.tick(AT);
    expect(attentions.calls).toBe(1);
    release();
    await first;
  });

  it('过期关注按策略负责人生成复查关注并落库等待对象', async () => {
    const { scheduler, attentions, notifier } = makeScheduler({
      escalationOwner: 'ou-owner',
    });
    attentions.expired = [expiredAttention()];

    await scheduler.tick(AT);

    expect(attentions.asked).toHaveLength(1);
    expect(attentions.asked[0].kind).toBe('review');
    expect(attentions.asked[0].assignee).toBe('ou-owner');
    expect(attentions.asked[0].question).toContain('验收标准？');
    expect(attentions.asked[0].deadline?.getTime()).toBe(
      AT.getTime() + 24 * 60 * 60 * 1000,
    );
    expect(notifier.jobs[0].text).toContain('待办已过期');
    expect(notifier.jobs[0].text).toContain('<at user_id="ou-owner">');
  });

  it('来源类型专属负责人优先于默认负责人', async () => {
    const { scheduler, attentions } = makeScheduler({
      escalationOwner: 'ou-default',
      escalationOwnerBySource: { lark: 'ou-lark' },
    });
    attentions.expired = [expiredAttention()];

    await scheduler.tick(AT);

    expect(attentions.asked[0].assignee).toBe('ou-lark');
  });

  it('未配置负责人时仍升级但不 @', async () => {
    const { scheduler, attentions, notifier } = makeScheduler();
    attentions.expired = [expiredAttention()];

    await scheduler.tick(AT);

    expect(attentions.asked[0].assignee).toBe('actor-1');
    expect(notifier.jobs[0].text).not.toContain('<at');
  });

  it('复查关注过期只提醒，不再生成新的升级关注', async () => {
    const { scheduler, attentions, notifier } = makeScheduler({
      escalationOwner: 'ou-owner',
    });
    attentions.expired = [
      expiredAttention({ kind: 'review', assignee: 'ou-owner' }),
    ];

    await scheduler.tick(AT);

    expect(attentions.asked).toHaveLength(0);
    expect(notifier.jobs[0].text).toContain('待办已过期');
    expect(notifier.jobs[0].text).toContain('<at user_id="ou-owner">');
  });

  it('失败后允许下一轮继续', async () => {
    const { scheduler, attentions } = makeScheduler();
    attentions.error = new Error('db down');

    await expect(scheduler.tick(AT)).resolves.toBeUndefined();
    attentions.error = null;
    await scheduler.tick(AT);

    expect(attentions.calls).toBe(2);
  });

  it('watchdogEnabled=false 时跳过停滞扫描', async () => {
    const { scheduler, attentions, stale } = makeScheduler({
      watchdogEnabled: false,
    });

    await scheduler.tick(AT);

    expect(attentions.calls).toBe(1);
    expect(stale.calls).toBe(0);
  });
});
