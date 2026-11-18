import { describe, expect, it } from 'vitest';
import type { Artifact } from '../../domain/artifact.entity';
import type { ArtifactRepository } from '../../domain/artifact.repository';
import type { Attention } from '../../domain/attention.entity';
import type { AttentionRepository } from '../../domain/attention.repository';
import type { BreakdownQueuePort } from '../../domain/breakdown-queue.port';
import type {
  ClarificationInput,
  ClarificationOutput,
  ClarificationPort,
} from '../../domain/clarification.port';
import type { MandateRepository } from '../../domain/mandate.repository';
import { Policy } from '../../domain/policy.entity';
import type { TicketRepository } from '../../domain/ticket.repository';
import { Trigger } from '../../domain/trigger.entity';
import { ArtifactService } from '../artifact.service';
import { AttentionService } from '../attention.service';
import { ClarificationService } from '../clarification.service';

const AT = new Date('2026-11-16T00:00:00.000Z');

class FakeArtifactRepository implements ArtifactRepository {
  readonly rows = new Map<string, Artifact>();
  async findById(id: string): Promise<Artifact | null> {
    return this.rows.get(id) ?? null;
  }
  async listByTicket(): Promise<Artifact[]> {
    return [];
  }
  async findLatest(
    ticketId: string,
    kind: Artifact['kind'],
  ): Promise<Artifact | null> {
    return (
      [...this.rows.values()]
        .filter(
          (artifact) =>
            artifact.ticketId === ticketId && artifact.kind === kind,
        )
        .sort((left, right) => right.version - left.version)[0] ?? null
    );
  }
  async save(artifact: Artifact): Promise<void> {
    this.rows.set(artifact.id, artifact);
  }
}

class FakeAttentionRepository implements AttentionRepository {
  readonly rows = new Map<string, Attention>();
  async findById(id: string): Promise<Attention | null> {
    return this.rows.get(id) ?? null;
  }
  async listOpenByTicket(): Promise<Attention[]> {
    return [];
  }
  async listOpen(): Promise<Attention[]> {
    return [];
  }
  async listByTicket(): Promise<Attention[]> {
    return [];
  }

  async save(attention: Attention): Promise<void> {
    this.rows.set(attention.id, attention);
  }
}

class FakeClarification implements ClarificationPort {
  constructor(private readonly output: ClarificationOutput) {}
  async clarify(): Promise<ClarificationOutput> {
    return this.output;
  }
}

const policy = Policy.create({
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
  text: '需要导出功能',
  payload: {},
  occurredAt: AT,
  receivedAt: AT,
});

const input: ClarificationInput = {
  threadId: 'thread-1',
  ticketId: 'ticket-1',
  triggers: [trigger],
  policy,
};

class FakeBreakdownQueue implements BreakdownQueuePort {
  readonly jobs: Array<{ ticketId: string; speculative?: boolean }> = [];
  async enqueue(job: {
    ticketId: string;
    speculative?: boolean;
  }): Promise<void> {
    this.jobs.push(job);
  }
}

function makeService(output: ClarificationOutput): {
  service: ClarificationService;
  artifacts: FakeArtifactRepository;
  attentions: FakeAttentionRepository;
  queue: FakeBreakdownQueue;
} {
  const artifacts = new FakeArtifactRepository();
  const attentions = new FakeAttentionRepository();
  const queue = new FakeBreakdownQueue();
  return {
    service: new ClarificationService(
      new FakeClarification(output),
      new ArtifactService(artifacts),
      new AttentionService(
        attentions,
        undefined,
        {
          findById: async () =>
            ({ id: 'ticket-1', mandateId: 'mandate-1' }) as never,
        } as unknown as TicketRepository,
        {
          findById: async () => ({ actorId: 'ou-requester' }) as never,
        } as unknown as MandateRepository,
      ),
      queue,
    ),
    artifacts,
    attentions,
    queue,
  };
}

describe('ClarificationService.start', () => {
  it('产物落版本，问题转关注并截断到 5 个', async () => {
    const questions = Array.from({ length: 7 }, (_, index) => ({
      question: `问题 ${index + 1}`,
    }));
    const { service, artifacts, attentions } = makeService({
      summary: '需求澄清',
      draft: { goal: '导出' },
      questions,
    });

    const result = await service.start(input);
    const artifact = result.artifact;
    if (!artifact) throw new Error('期望落澄清产物');

    expect(artifact.version).toBe(1);
    expect(artifact.kind).toBe('clarify');
    expect(result.attentions).toHaveLength(5);
    expect(attentions.rows.size).toBe(5);
    expect(
      result.attentions.every(
        (attention) =>
          attention.deadline instanceof Date &&
          attention.deadline.getTime() > Date.now(),
      ),
    ).toBe(true);
    expect(artifacts.rows.size).toBe(1);
    const payload = artifact.payload as { questions: unknown[] };
    expect(payload.questions).toHaveLength(5);
  });

  it('策略开启且无问题时不打扰先投机出拆解稿', async () => {
    const policyWithSpeculation = Policy.create({
      id: 'policy-2',
      version: 2,
      acceptMode: 'explicit',
      rules: { speculationEnabled: true },
      createdBy: 'admin',
      now: AT,
    });
    const { service, queue } = makeService({
      summary: '信息完整',
      draft: { goal: '导出' },
      questions: [],
    });

    await service.start({ ...input, policy: policyWithSpeculation });

    expect(queue.jobs).toHaveLength(1);
    expect(queue.jobs[0].speculative).toBe(true);
  });

  it('策略未开启投机时不投递拆解任务', async () => {
    const { service, queue } = makeService({
      summary: '信息完整',
      draft: { goal: '导出' },
      questions: [],
    });

    await service.start(input);

    expect(queue.jobs).toHaveLength(0);
  });

  it('仍有待确认问题时不投机', async () => {
    const policyWithSpeculation = Policy.create({
      id: 'policy-2',
      version: 2,
      acceptMode: 'explicit',
      rules: { speculationEnabled: true },
      createdBy: 'admin',
      now: AT,
    });
    const { service, queue } = makeService({
      summary: '信息不足',
      draft: {},
      questions: [{ question: '范围？' }],
    });

    await service.start({ ...input, policy: policyWithSpeculation });

    expect(queue.jobs).toHaveLength(0);
  });

  it('低分走人工分支：只写复核关注，不落产物', async () => {
    const { service, attentions, artifacts } = makeService({
      summary: '信息不足',
      draft: {},
      questions: [],
      score: 0.3,
      needsHuman: true,
    });

    const result = await service.start(input);

    expect(result.artifact).toBeNull();
    expect(artifacts.rows.size).toBe(0);
    expect(result.attentions).toHaveLength(1);
    expect(result.attentions[0].kind).toBe('review');
    expect(result.attentions[0].question).toContain('低于阈值');
    expect(attentions.rows.size).toBe(1);
  });

  it('没有问题时只落产物', async () => {
    const { service, attentions } = makeService({
      summary: '信息完整',
      draft: {},
      questions: [],
    });

    const result = await service.start(input);

    expect(result.attentions).toHaveLength(0);
    expect(attentions.rows.size).toBe(0);
  });
});
