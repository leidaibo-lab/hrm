import { describe, expect, it } from 'vitest';
import type { AcceptanceRepository } from '../../domain/acceptance.repository';
import type { Subscription } from '../../domain/subscription.entity';
import type { SubscriptionRepository } from '../../domain/subscription.repository';
import type { Thread } from '../../domain/thread.entity';
import type { ThreadRepository } from '../../domain/thread.repository';
import { AcceptanceService } from '../acceptance.service';
import { SubscriptionService } from '../subscription.service';

class FakeAcceptanceRepository implements AcceptanceRepository {
  calls = 0;
  last: Parameters<AcceptanceRepository['accept']>[0] | null = null;

  async accept(
    input: Parameters<AcceptanceRepository['accept']>[0],
  ): Promise<void> {
    this.calls += 1;
    this.last = input;
  }
}

const AT = new Date('2026-11-16T00:00:00.000Z');

class FakeSubscriptionRepository implements SubscriptionRepository {
  readonly rows: Subscription[] = [];
  async listByThread(): Promise<Subscription[]> {
    return [];
  }
  async listByTicket(): Promise<Subscription[]> {
    return [];
  }
  async add(subscription: Subscription): Promise<void> {
    this.rows.push(subscription);
  }
  async remove(): Promise<void> {}
}

class FakeThreadRepository implements ThreadRepository {
  constructor(private readonly scopeKey: string | null) {}
  async findById(): Promise<Thread | null> {
    return { scopeKey: this.scopeKey } as Thread;
  }
  async findByExternalKey(): Promise<Thread | null> {
    return null;
  }
  async list(): Promise<Thread[]> {
    return [];
  }
  async save(): Promise<void> {}
}

function makeService(threadScope: string | null = 'project-a'): {
  service: AcceptanceService;
  repository: FakeAcceptanceRepository;
} {
  const repository = new FakeAcceptanceRepository();
  return {
    service: new AcceptanceService(
      repository,
      new FakeThreadRepository(threadScope),
      new SubscriptionService(new FakeSubscriptionRepository()),
    ),
    repository,
  };
}

const input = {
  threadId: 'thread-1',
  triggerIds: ['trigger-1', 'trigger-2'],
  policyId: 'policy-1',
  policyVersion: 3,
  strength: 'explicit' as const,
  scope: { projectKey: 'project-a' },
  actorId: 'open-id-1',
  actorUserId: 'user-1',
  sourceType: 'lark',
  matchedRules: ['rule-1'],
  kind: 'requirement' as const,
  scopeKey: 'project-a',
  reason: '信息完整',
  now: AT,
};

describe('AcceptanceService.accept', () => {
  it('构造接单结论、授权与工单并原子写入一次', async () => {
    const { service, repository } = makeService();

    const result = await service.accept(input);

    expect(repository.calls).toBe(1);
    expect(result.decision.isAccepted).toBe(true);
    expect(result.decision.triggerIds).toEqual(['trigger-1', 'trigger-2']);
    expect(result.ticket.mandateId).toBe(result.mandate.id);
    expect(result.ticket.threadId).toBe('thread-1');
    expect(result.ticket.isOpen).toBe(true);
  });

  it('写入内容与输入一致', async () => {
    const { service, repository } = makeService();
    await service.accept(input);

    expect(repository.last?.mandate.scope).toEqual(input.scope);
    expect(repository.last?.mandate.actorId).toBe('open-id-1');
    expect(repository.last?.ticket.kind).toBe('requirement');
    expect(repository.last?.subscription).toMatchObject({
      threadId: 'thread-1',
      reason: 'started',
    });
  });

  it('工单范围与线程范围不一致时拒绝开票', async () => {
    const { service, repository } = makeService('project-b');

    await expect(service.accept(input)).rejects.toThrow(
      '工单范围必须与线程范围一致',
    );
    expect(repository.calls).toBe(0);
  });

  it('工单与授权使用同一时间点', async () => {
    const { service } = makeService();
    const result = await service.accept(input);

    expect(result.mandate.createdAt).toEqual(AT);
    expect(result.ticket.openedAt).toEqual(AT);
  });
});
