import { describe, expect, it } from 'vitest';
import type { QueueService } from '../../../../platform/queue';
import type { Policy } from '../../domain/policy.entity';
import { Policy as PolicyAggregate } from '../../domain/policy.entity';
import type { PolicyRepository } from '../../domain/policy.repository';
import { Ticket } from '../../domain/ticket.entity';
import type { TicketRepository } from '../../domain/ticket.repository';
import { Trigger } from '../../domain/trigger.entity';
import type { TriggerRepository } from '../../domain/trigger.repository';
import type { AuditRecordService } from '../audit-record.service';
import type { ClarificationService } from '../clarification.service';
import { ClarificationWorkerService } from '../clarification-worker.service';
import type { RunFailureService } from '../run-failure.service';

const AT = new Date('2026-11-16T00:00:00.000Z');

class FakeTicketRepository implements TicketRepository {
  constructor(private readonly ticket: Ticket | null) {}
  async findById(): Promise<Ticket | null> {
    return this.ticket;
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

class FakeTriggerRepository implements TriggerRepository {
  constructor(private readonly rows: Trigger[]) {}
  async findByDedupeKey(): Promise<Trigger | null> {
    return null;
  }
  async create(): Promise<boolean> {
    return true;
  }
  async listByThread(): Promise<Trigger[]> {
    return this.rows;
  }
  async listByIds(): Promise<Trigger[]> {
    return this.rows;
  }
  async saveDisposition(): Promise<void> {}
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

class FakeClarification {
  calls = 0;
  error: Error | null = null;
  async start(): Promise<void> {
    this.calls += 1;
    if (this.error) throw this.error;
  }
}

class FakeRunFailure {
  readonly reports: Array<{ ticketId: string; role: string; error: string }> =
    [];
  async report(input: {
    ticketId: string;
    role: string;
    error: string;
  }): Promise<null> {
    this.reports.push(input);
    return null;
  }
}

class FakeAudit {
  readonly records: Array<{
    action: string;
    path: string;
    statusCode: number;
    detail: unknown;
  }> = [];
  async record(input: {
    action: string;
    path: string;
    statusCode: number;
    detail: unknown;
  }): Promise<void> {
    this.records.push(input);
  }
}

function makeService(options?: {
  ticketOpen?: boolean;
  policy?: Policy | null;
  triggers?: Trigger[];
}): {
  service: ClarificationWorkerService;
  clarification: FakeClarification;
  audit: FakeAudit;
  runFailure: FakeRunFailure;
} {
  const ticket = Ticket.open({
    id: 'ticket-1',
    mandateId: 'mandate-1',
    threadId: 'thread-1',
    kind: 'requirement',
    now: AT,
  });
  if (options?.ticketOpen === false) ticket.end('已结束', AT);
  const policy = PolicyAggregate.create({
    id: 'policy-1',
    version: 1,
    acceptMode: 'explicit',
    rules: {},
    createdBy: 'admin',
    now: AT,
  });
  const trigger = Trigger.create({
    id: 'trigger-1',
    dedupeKey: 'lark:1',
    sourceType: 'lark',
    instanceId: 'instance-1',
    threadId: 'thread-1',
    actorId: 'open-id-1',
    text: '需求',
    payload: {},
    occurredAt: AT,
    receivedAt: AT,
  });
  const clarification = new FakeClarification();
  const audit = new FakeAudit();
  const runFailure = new FakeRunFailure();
  return {
    service: new ClarificationWorkerService(
      {} as QueueService,
      new FakeTicketRepository(ticket),
      new FakeTriggerRepository(options?.triggers ?? [trigger]),
      new FakePolicyRepository(
        options?.policy === undefined ? policy : options.policy,
      ),
      clarification as unknown as ClarificationService,
      audit as unknown as AuditRecordService,
      runFailure as unknown as RunFailureService,
    ),
    clarification,
    audit,
    runFailure,
  };
}

const job = {
  ticketId: 'ticket-1',
  threadId: 'thread-1',
  triggerIds: ['trigger-1'],
};

describe('ClarificationWorkerService.handle', () => {
  it('工单进行中时执行澄清', async () => {
    const { service, clarification } = makeService();
    await service.handle(job);
    expect(clarification.calls).toBe(1);
  });

  it('工单已结束时跳过', async () => {
    const { service, clarification } = makeService({ ticketOpen: false });
    await service.handle(job);
    expect(clarification.calls).toBe(0);
  });

  it('没有策略时跳过', async () => {
    const { service, clarification } = makeService({ policy: null });
    await service.handle(job);
    expect(clarification.calls).toBe(0);
  });

  it('事件缺失时跳过', async () => {
    const { service, clarification } = makeService({ triggers: [] });
    await service.handle(job);
    expect(clarification.calls).toBe(0);
  });
});

describe('ClarificationWorkerService 运行审计', () => {
  it('成功运行写 agentic.run 审计', async () => {
    const { service, audit } = makeService();

    await service.handle({
      ticketId: 'ticket-1',
      threadId: 'thread-1',
      triggerIds: ['trigger-1'],
    });

    expect(audit.records).toHaveLength(1);
    expect(audit.records[0].action).toBe('agentic.run');
    expect(audit.records[0].statusCode).toBe(200);
    expect(audit.records[0].detail).toMatchObject({
      ticketId: 'ticket-1',
      policyVersion: 1,
      triggerIds: ['trigger-1'],
    });
    expect((audit.records[0].detail as { mandateId: string }).mandateId).toBe(
      'mandate-1',
    );
  });

  it('失败运行写 500 审计并继续抛出', async () => {
    const { service, clarification, audit } = makeService();
    clarification.error = new Error('模型失败');

    await expect(
      service.handle({
        ticketId: 'ticket-1',
        threadId: 'thread-1',
        triggerIds: ['trigger-1'],
      }),
    ).rejects.toThrow('模型失败');

    expect(audit.records[0].statusCode).toBe(500);
    expect((audit.records[0].detail as { error: string }).error).toBe(
      '模型失败',
    );
  });
});

describe('ClarificationWorkerService.handleJob', () => {
  it('末次尝试失败时转人工关注并继续抛出', async () => {
    const { service, clarification, runFailure } = makeService();
    clarification.error = new Error('模型失败');

    await expect(
      service.handleJob({
        data: {
          ticketId: 'ticket-1',
          threadId: 'thread-1',
          triggerIds: ['trigger-1'],
        },
        opts: { attempts: 2 },
        attemptsMade: 1,
      } as never),
    ).rejects.toThrow('模型失败');

    expect(runFailure.reports).toEqual([
      { ticketId: 'ticket-1', role: 'clarify', error: '模型失败' },
    ]);
  });

  it('非末次尝试失败不转人工', async () => {
    const { service, clarification, runFailure } = makeService();
    clarification.error = new Error('模型失败');

    await expect(
      service.handleJob({
        data: {
          ticketId: 'ticket-1',
          threadId: 'thread-1',
          triggerIds: ['trigger-1'],
        },
        opts: { attempts: 2 },
        attemptsMade: 0,
      } as never),
    ).rejects.toThrow('模型失败');

    expect(runFailure.reports).toEqual([]);
  });
});
