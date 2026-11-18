import { describe, expect, it } from 'vitest';
import { Artifact } from '../../domain/artifact.entity';
import type { ArtifactRepository } from '../../domain/artifact.repository';
import type { Attention } from '../../domain/attention.entity';
import type { AttentionRepository } from '../../domain/attention.repository';
import type {
  BreakdownInput,
  BreakdownOutput,
  BreakdownPort,
} from '../../domain/breakdown.port';
import type { MandateRepository } from '../../domain/mandate.repository';
import { Policy } from '../../domain/policy.entity';
import type { TicketRepository } from '../../domain/ticket.repository';
import { ArtifactService } from '../artifact.service';
import { AttentionService } from '../attention.service';
import { BreakdownService } from '../breakdown.service';

const AT = new Date('2026-11-16T00:00:00.000Z');

class FakeArtifactRepository implements ArtifactRepository {
  readonly rows = new Map<string, Artifact>();
  async findById(id: string): Promise<Artifact | null> {
    return this.rows.get(id) ?? null;
  }
  async listByTicket(): Promise<Artifact[]> {
    return [...this.rows.values()];
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

class FakeBreakdown implements BreakdownPort {
  constructor(private readonly output: BreakdownOutput) {}
  async breakdown(): Promise<BreakdownOutput> {
    return this.output;
  }
}

const input: BreakdownInput = {
  ticketId: 'ticket-1',
  threadId: 'thread-1',
  triggers: [],
  policy: Policy.create({
    id: 'policy-1',
    version: 1,
    acceptMode: 'explicit',
    rules: {},
    createdBy: 'admin',
    now: AT,
  }),
};

function makeService(output: BreakdownOutput): {
  service: BreakdownService;
  artifacts: FakeArtifactRepository;
  attentions: FakeAttentionRepository;
} {
  const artifacts = new FakeArtifactRepository();
  const attentions = new FakeAttentionRepository();
  return {
    service: new BreakdownService(
      new FakeBreakdown(output),
      artifacts,
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
    ),
    artifacts,
    attentions,
  };
}

describe('BreakdownService.start', () => {
  it('拆解稿落版本并生成确认关注', async () => {
    const { service, artifacts, attentions } = makeService({
      summary: '拆成两个任务',
      tasks: [
        {
          title: '任务一',
          description: null,
          dependsOn: null,
          owner: null,
        },
        {
          title: '任务二',
          description: '依赖任务一',
          dependsOn: [0],
          owner: 'ou-owner',
        },
      ],
    });

    const result = await service.start(input);

    expect(result.artifact.kind).toBe('breakdown');
    expect(result.artifact.version).toBe(1);
    expect(result.attention?.kind).toBe('confirm');
    expect(result.attention?.question).toContain('2 个任务');
    expect(artifacts.rows.size).toBe(1);
    expect(attentions.rows.size).toBe(1);
  });
});

function speculativeArtifact(): Artifact {
  return Artifact.create({
    id: 'artifact-spec',
    ticketId: 'ticket-1',
    kind: 'breakdown',
    version: 1,
    payload: {
      summary: '投机拆解',
      tasks: [{ title: '任务一' }],
      speculative: true,
    },
    now: AT,
  });
}

describe('BreakdownService 投机执行', () => {
  it('投机模式只落草稿，不创建确认关注', async () => {
    const { service, artifacts, attentions } = makeService({
      summary: null,
      tasks: [],
    });

    const result = await service.start(input, { speculative: true });

    expect(result.attention).toBeNull();
    expect(result.artifact.payload).toMatchObject({ speculative: true });
    expect(attentions.rows.size).toBe(0);
    expect(artifacts.rows.size).toBe(1);
  });

  it('澄清确认后交付投机稿：追加正式版本并建确认关注', async () => {
    const { service, artifacts, attentions } = makeService({
      summary: null,
      tasks: [],
    });
    await artifacts.save(speculativeArtifact());

    const delivered = await service.deliverSpeculative('ticket-1');

    expect(delivered).toBe(true);
    const latest = await artifacts.findLatest('ticket-1', 'breakdown');
    if (!latest) throw new Error('缺少最新拆解产物');
    expect(latest.version).toBe(2);
    const payload = latest.payload as {
      summary?: unknown;
      speculative?: unknown;
    };
    expect(payload.summary).toBe('投机拆解');
    expect(payload.speculative).toBeUndefined();
    expect(attentions.rows.size).toBe(1);
  });

  it('没有投机稿时交付返回 false', async () => {
    const { service } = makeService({ summary: null, tasks: [] });
    await expect(service.deliverSpeculative('ticket-1')).resolves.toBe(false);
  });

  it('澄清被修改或驳回时丢弃投机稿', async () => {
    const { service, artifacts } = makeService({ summary: null, tasks: [] });
    const speculative = speculativeArtifact();
    await artifacts.save(speculative);

    await expect(service.discardSpeculative('ticket-1')).resolves.toBe(true);

    expect(speculative.status).toBe('superseded');
  });
});
