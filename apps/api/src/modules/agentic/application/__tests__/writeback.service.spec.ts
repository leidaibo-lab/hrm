import { describe, expect, it } from 'vitest';
import { Artifact } from '../../domain/artifact.entity';
import { Policy } from '../../domain/policy.entity';
import type { PolicyRepository } from '../../domain/policy.repository';
import type { ThreadNotifierService } from '../thread-notifier.service';
import { WritebackService } from '../writeback.service';

const AT = new Date('2026-11-16T00:00:00.000Z');

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

class FakeNotifier {
  readonly jobs: Array<{ threadId: string; text: string; key: string }> = [];
  fieldWrites = 0;
  acceptsFields = false;

  async notify(threadId: string, text: string, key: string): Promise<void> {
    this.jobs.push({ threadId, text, key });
  }

  async notifyFields(): Promise<boolean> {
    this.fieldWrites += 1;
    return this.acceptsFields;
  }
}

function makePolicy(fields?: string[]): Policy {
  return Policy.create({
    id: 'policy-1',
    version: 1,
    acceptMode: 'explicit',
    rules: { writebackFields: fields },
    createdBy: 'admin',
    now: AT,
  });
}

function artifact(): Artifact {
  return Artifact.create({
    id: 'artifact-1',
    ticketId: 'ticket-1',
    kind: 'clarify',
    version: 1,
    payload: {
      draft: { title: '导出功能', priority: 'P0', owner: 'alice' },
    },
    now: AT,
  });
}

function makeService(policy: Policy | null): {
  service: WritebackService;
  notifier: FakeNotifier;
} {
  const notifier = new FakeNotifier();
  return {
    service: new WritebackService(
      new FakePolicyRepository(policy),
      notifier as unknown as ThreadNotifierService,
    ),
    notifier,
  };
}

describe('WritebackService.writeback', () => {
  it('只写白名单字段', async () => {
    const { service, notifier } = makeService(makePolicy(['title']));

    const result = await service.writeback('thread-1', 'ticket-1', artifact());

    expect(result.fields).toEqual({ title: '导出功能' });
    expect(notifier.jobs[0].text).toContain('title：导出功能');
    expect(notifier.jobs[0].text).not.toContain('priority');
  });

  it('没有白名单时不写', async () => {
    const { service, notifier } = makeService(makePolicy(undefined));
    const result = await service.writeback('thread-1', 'ticket-1', artifact());
    expect(result.fields).toEqual({});
    expect(notifier.jobs).toHaveLength(0);
  });

  it('有记录定位时走字段写回，不发文本', async () => {
    const { service, notifier } = makeService(makePolicy(['title']));
    notifier.acceptsFields = true;

    const result = await service.writeback('thread-1', 'ticket-1', artifact());

    expect(result.fields).toEqual({ title: '导出功能' });
    expect(notifier.fieldWrites).toBe(1);
    expect(notifier.jobs).toHaveLength(0);
  });

  it('没有策略时不写', async () => {
    const { service } = makeService(null);
    const result = await service.writeback('thread-1', 'ticket-1', artifact());
    expect(result.fields).toEqual({});
  });
});
