import { describe, expect, it } from 'vitest';
import type { Assignment } from '../../domain/assignment.entity';
import type { AssignmentRepository } from '../../domain/assignment.repository';
import type { Attention } from '../../domain/attention.entity';
import type { AttentionRepository } from '../../domain/attention.repository';
import { Mandate } from '../../domain/mandate.entity';
import type { MandateRepository } from '../../domain/mandate.repository';
import { Policy } from '../../domain/policy.entity';
import type { PolicyRepository } from '../../domain/policy.repository';
import { Ticket } from '../../domain/ticket.entity';
import type { TicketRepository } from '../../domain/ticket.repository';
import { AttentionService } from '../attention.service';
import { StaleTicketService } from '../stale-ticket.service';
import type { ThreadNotifierService } from '../thread-notifier.service';

const AT = new Date('2026-11-16T00:00:00.000Z');

class FakeTicketRepository implements TicketRepository {
  constructor(private readonly rows: Ticket[]) {}
  async findById(): Promise<Ticket | null> {
    return null;
  }
  async findByMandateId(): Promise<Ticket | null> {
    return null;
  }
  async list(): Promise<Ticket[]> {
    return this.rows;
  }
  async listByThread(): Promise<Ticket[]> {
    return [];
  }
  async save(): Promise<void> {}
}

class FakeAttentionRepository implements AttentionRepository {
  constructor(private readonly open: Attention[]) {}
  readonly saved: Attention[] = [];
  async findById(): Promise<Attention | null> {
    return null;
  }
  async listOpenByTicket(): Promise<Attention[]> {
    return this.open;
  }
  async listOpen(): Promise<Attention[]> {
    return this.open;
  }
  async listByTicket(): Promise<Attention[]> {
    return [];
  }

  async save(attention: Attention): Promise<void> {
    this.saved.push(attention);
  }
}

class FakeAssignmentRepository implements AssignmentRepository {
  constructor(private readonly active: Assignment | null) {}
  async findById(): Promise<Assignment | null> {
    return null;
  }
  async listByTicket(): Promise<Assignment[]> {
    return [];
  }
  async findActiveByTicket(): Promise<Assignment | null> {
    return this.active;
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
  constructor(private readonly policy: Policy | null) {}
  async findById(): Promise<Policy | null> {
    return this.policy;
  }
  async findCurrent(): Promise<Policy | null> {
    return this.policy;
  }
  async findByVersion(): Promise<Policy | null> {
    return this.policy;
  }
  async create(): Promise<void> {}
}

class FakeThreadNotifier {
  readonly jobs: Array<{ threadId: string; text: string }> = [];

  async notify(threadId: string, text: string): Promise<void> {
    this.jobs.push({ threadId, text });
  }
}

function openTicket(openedAt: Date): Ticket {
  return Ticket.open({
    id: 'ticket-1',
    mandateId: 'mandate-1',
    threadId: 'thread-1',
    kind: 'requirement',
    now: openedAt,
  });
}

function makeService(options: {
  tickets: Ticket[];
  open?: Attention[];
  active?: Assignment | null;
  owner?: string;
  rules?: Record<string, unknown>;
}): {
  service: StaleTicketService;
  attentions: FakeAttentionRepository;
  notifier: FakeThreadNotifier;
} {
  const attentions = new FakeAttentionRepository(options.open ?? []);
  const notifier = new FakeThreadNotifier();
  return {
    service: new StaleTicketService(
      new FakeTicketRepository(options.tickets),
      attentions,
      new FakeAssignmentRepository(options.active ?? null),
      new AttentionService(attentions),
      notifier as unknown as ThreadNotifierService,
      new FakePolicyRepository(
        options.owner || options.rules
          ? Policy.create({
              id: 'policy-1',
              version: 1,
              acceptMode: 'explicit',
              rules: options.rules ?? { escalationOwner: options.owner },
              createdBy: 'admin',
              now: AT,
            })
          : null,
      ) as unknown as PolicyRepository,
      new FakeMandateRepository() as unknown as MandateRepository,
    ),
    attentions,
    notifier,
  };
}

describe('StaleTicketService.scan', () => {
  it('超过阈值的开放工单生成升级关注', async () => {
    const ticket = openTicket(new Date('2026-11-14T00:00:00.000Z'));
    const { service, attentions, notifier } = makeService({
      tickets: [ticket],
    });

    const created = await service.scan(AT, 24 * 60 * 60 * 1000);

    expect(created).toBe(1);
    expect(notifier.jobs).toHaveLength(1);
    expect(attentions.saved).toHaveLength(1);
    expect(attentions.saved[0].kind).toBe('review');
    expect(attentions.saved[0].question).toContain('48 小时');
    expect(attentions.saved[0].assignee).toBe('actor-1');
  });

  it('策略负责人写入升级关注的等待对象', async () => {
    const ticket = openTicket(new Date('2026-11-14T00:00:00.000Z'));
    const { service, attentions, notifier } = makeService({
      tickets: [ticket],
      owner: 'ou-owner',
    });

    await service.scan(AT, 24 * 60 * 60 * 1000);

    expect(attentions.saved[0].assignee).toBe('ou-owner');
    expect(notifier.jobs[0].text).toContain('<at user_id="ou-owner">');
  });

  it('来源类型专属负责人优先于默认负责人', async () => {
    const ticket = openTicket(new Date('2026-11-14T00:00:00.000Z'));
    const { service, attentions } = makeService({
      tickets: [ticket],
      owner: 'ou-default',
      rules: {
        escalationOwner: 'ou-default',
        escalationOwnerBySource: { lark: 'ou-lark' },
      },
    });

    await service.scan(AT, 24 * 60 * 60 * 1000);

    expect(attentions.saved[0].assignee).toBe('ou-lark');
  });

  it('未超过阈值不处理', async () => {
    const ticket = openTicket(new Date('2026-11-15T23:00:00.000Z'));
    const { service, notifier } = makeService({ tickets: [ticket] });
    expect(await service.scan(AT, 24 * 60 * 60 * 1000)).toBe(0);
    expect(notifier.jobs).toHaveLength(0);
  });

  it('已有待答关注时跳过', async () => {
    const ticket = openTicket(new Date('2026-11-14T00:00:00.000Z'));
    const { service } = makeService({
      tickets: [ticket],
      open: [{ id: 'attention-1' } as unknown as Attention],
    });
    expect(await service.scan(AT, 24 * 60 * 60 * 1000)).toBe(0);
  });

  it('有进行中派发时跳过', async () => {
    const ticket = openTicket(new Date('2026-11-14T00:00:00.000Z'));
    const { service } = makeService({
      tickets: [ticket],
      active: { id: 'assignment-1' } as unknown as Assignment,
    });
    expect(await service.scan(AT, 24 * 60 * 60 * 1000)).toBe(0);
  });
});
