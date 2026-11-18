import { describe, expect, it } from 'vitest';
import { Artifact } from '../../domain/artifact.entity';
import type { ArtifactRepository } from '../../domain/artifact.repository';
import type { Attention } from '../../domain/attention.entity';
import { Attention as AttentionEntity } from '../../domain/attention.entity';
import { AttentionStateError } from '../../domain/attention.error';
import type { AttentionRepository } from '../../domain/attention.repository';
import type { BreakdownQueuePort } from '../../domain/breakdown-queue.port';
import { Ticket } from '../../domain/ticket.entity';
import type { TicketRepository } from '../../domain/ticket.repository';
import type { TicketLockPort } from '../../domain/ticket-lock.port';
import { ArtifactService } from '../artifact.service';
import type { AttentionService } from '../attention.service';
import type { BreakdownService } from '../breakdown.service';
import { GateService } from '../gate.service';
import type { ThreadNotifierService } from '../thread-notifier.service';
import type { WritebackService } from '../writeback.service';

const AT = new Date('2026-11-16T00:00:00.000Z');

class FakeAttentionRepository implements AttentionRepository {
  constructor(
    private readonly open: Attention[],
    private readonly selected: Attention | null = null,
  ) {}
  async findById(): Promise<Attention | null> {
    return this.selected;
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

  async save(): Promise<void> {}
}

class FakeTicketLock {
  busy = false;
  async acquire(): Promise<{ release: () => Promise<void> } | null> {
    if (this.busy) return null;
    return { release: async () => undefined };
  }
}

class FakeAttentionAnswerService {
  calls: string[] = [];
  active = 0;
  maxActive = 0;

  constructor(
    private readonly attention: AttentionEntity,
    private readonly error?: Error,
  ) {}

  async answer(id: string): Promise<AttentionEntity> {
    this.active += 1;
    this.maxActive = Math.max(this.maxActive, this.active);
    this.calls.push(id);
    await new Promise((resolve) => setTimeout(resolve, 5));
    this.active -= 1;
    if (this.error) throw this.error;
    return this.attention;
  }
}

class FakeArtifactRepository implements ArtifactRepository {
  readonly saved: Artifact[] = [];
  readonly byId = new Map<string, Artifact>();
  readonly rows: Artifact[];
  constructor(artifact: Artifact | Artifact[] | null) {
    this.rows = artifact
      ? Array.isArray(artifact)
        ? artifact
        : [artifact]
      : [];
    for (const item of this.rows) this.byId.set(item.id, item);
  }
  async findById(id: string): Promise<Artifact | null> {
    return this.byId.get(id) ?? null;
  }
  async listByTicket(): Promise<Artifact[]> {
    return this.rows;
  }
  async findLatest(ticketId: string, kind: string): Promise<Artifact | null> {
    return (
      this.rows
        .filter((row) => row.ticketId === ticketId && row.kind === kind)
        .sort((left, right) => right.version - left.version)[0] ?? null
    );
  }
  async save(artifact: Artifact): Promise<void> {
    this.saved.push(artifact);
    this.byId.set(artifact.id, artifact);
    this.rows.push(artifact);
  }
}

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

class FakeWriteback {
  fields: Record<string, unknown> = {};
  async writeback(): Promise<{ fields: Record<string, unknown> }> {
    return { fields: this.fields };
  }
}

class FakeBreakdownService {
  hasSpeculative = false;
  discarded = 0;

  async deliverSpeculative(): Promise<boolean> {
    return this.hasSpeculative;
  }

  async discardSpeculative(): Promise<boolean> {
    this.discarded += 1;
    return true;
  }
}

class FakeBreakdownQueue implements BreakdownQueuePort {
  readonly jobs: Array<{ ticketId: string; threadId: string }> = [];

  async enqueue(job: { ticketId: string; threadId: string }): Promise<void> {
    this.jobs.push(job);
  }
}

class FakeThreadNotifier {
  readonly jobs: Array<{
    threadId: string;
    text: string;
    idempotencyKey: string;
  }> = [];

  async notify(
    threadId: string,
    text: string,
    idempotencyKey: string,
  ): Promise<void> {
    this.jobs.push({ threadId, text, idempotencyKey });
  }
}

function makeService(options: {
  open?: Attention[];
  artifact?: Artifact | Artifact[] | null;
  ticket?: Ticket | null;
  selected?: AttentionEntity | null;
  busyLock?: boolean;
  answerError?: Error;
}): {
  service: GateService;
  notifier: FakeThreadNotifier;
  artifacts: FakeArtifactRepository;
  writeback: FakeWriteback;
  queue: FakeBreakdownQueue;
  breakdown: FakeBreakdownService;
} {
  const artifacts = new FakeArtifactRepository(options.artifact ?? null);
  const writeback = new FakeWriteback();
  const queue = new FakeBreakdownQueue();
  const breakdown = new FakeBreakdownService();
  const notifier = new FakeThreadNotifier();
  const ticketLock = new FakeTicketLock();
  if (options.busyLock) ticketLock.busy = true;
  return {
    service: new GateService(
      new FakeAttentionRepository(options.open ?? [], options.selected ?? null),
      artifacts,
      new ArtifactService(artifacts),
      new FakeTicketRepository(options.ticket ?? null),
      notifier as unknown as ThreadNotifierService,
      writeback as unknown as WritebackService,
      queue as unknown as BreakdownQueuePort,
      breakdown as unknown as BreakdownService,
      new FakeAttentionAnswerService(
        AttentionEntity.create({
          id: 'attention-1',
          ticketId: 'ticket-1',
          kind: 'clarify',
          question: '问题',
          deadline: AT,
          assignee: 'user-1',
          now: AT,
        }),
        options.answerError,
      ) as unknown as AttentionService,
      ticketLock as unknown as TicketLockPort,
    ),
    notifier,
    artifacts,
    writeback,
    queue,
    breakdown,
  };
}

function openTicket(): Ticket {
  return Ticket.open({
    id: 'ticket-1',
    mandateId: 'mandate-1',
    threadId: 'thread-1',
    kind: 'requirement',
    now: AT,
  });
}

function draft(): Artifact {
  return Artifact.create({
    id: 'artifact-1',
    ticketId: 'ticket-1',
    kind: 'clarify',
    version: 1,
    payload: {},
    now: AT,
  });
}

function openAttention(): Attention {
  return {
    id: 'attention-1',
    ticketId: 'ticket-1',
  } as unknown as Attention;
}

describe('GateService.onAttentionAnswered', () => {
  it('修改后生成新版本并确认', async () => {
    const artifact = draft();
    const { service, artifacts } = makeService({
      artifact,
      ticket: openTicket(),
    });

    await service.onAttentionAnswered(
      'ticket-1',
      'modify',
      undefined,
      '补充验收标准',
    );

    const revised = artifacts.saved.find((item) => item.version === 2);
    expect(revised?.status).toBe('confirmed');
    expect(artifact.status).toBe('superseded');
  });

  it('仍有未答问题时保持草稿', async () => {
    const artifact = draft();
    const { service } = makeService({ open: [openAttention()], artifact });
    await service.onAttentionAnswered('ticket-1');
    expect(artifact.status).toBe('draft');
  });

  it('问题全部回答后确认澄清稿', async () => {
    const artifact = draft();
    const { service, notifier, queue } = makeService({
      artifact,
      ticket: openTicket(),
    });
    await service.onAttentionAnswered('ticket-1');
    expect(artifact.status).toBe('confirmed');
    expect(notifier.jobs).toHaveLength(1);
    expect(queue.jobs).toHaveLength(1);
    expect(queue.jobs[0].ticketId).toBe('ticket-1');
    expect(notifier.jobs[0].threadId).toBe('thread-1');
  });

  it('没有澄清稿时不报错', async () => {
    const { service } = makeService({});
    await expect(
      service.onAttentionAnswered('ticket-1'),
    ).resolves.toBeUndefined();
  });

  it('驳回时结束工单并记录原因', async () => {
    const ticket = openTicket();
    const { service, notifier } = makeService({ ticket });
    await service.onAttentionAnswered('ticket-1', 'reject', '需求不成立');
    expect(ticket.status).toBe('ended');
    expect(ticket.endReason).toBe('需求不成立');
    expect(notifier.jobs[0].text).toContain('需求已驳回');
  });

  it('修改后旧版本废弃', async () => {
    const ticket = openTicket();
    const artifact = draft();
    const { service } = makeService({ ticket, artifact });
    await service.onAttentionAnswered('ticket-1', 'modify');
    expect(ticket.isOpen).toBe(true);
    expect(artifact.status).toBe('superseded');
  });

  it('已确认的产物不重复处理', async () => {
    const artifact = draft();
    artifact.confirm();
    const { service, notifier } = makeService({ artifact });
    await service.onAttentionAnswered('ticket-1');
    expect(artifact.status).toBe('confirmed');
    expect(notifier.jobs).toHaveLength(0);
  });
});

function confirmed(version: number, payload: unknown = {}): Artifact {
  const artifact = Artifact.create({
    id: `artifact-${version}`,
    ticketId: 'ticket-1',
    kind: 'clarify',
    version,
    payload,
    now: AT,
  });
  artifact.confirm();
  return artifact;
}

describe('GateService.revokeWriteback', () => {
  it('以上一版本内容追加新版本并写回', async () => {
    const v1 = confirmed(1, { summary: '旧版' });
    const v2 = confirmed(2, { summary: '新版' });
    const { service, artifacts, writeback } = makeService({
      artifact: [v1, v2],
      ticket: openTicket(),
    });
    writeback.fields = { summary: '旧版' };

    const result = await service.revokeWriteback('ticket-1');

    expect(result.artifact.version).toBe(3);
    expect(result.artifact.status).toBe('confirmed');
    expect(result.fields).toEqual({ summary: '旧版' });
    expect(v2.status).toBe('superseded');
    expect(artifacts.saved.some((item) => item.version === 3)).toBe(true);
  });

  it('没有上一版本时拒绝撤销', async () => {
    const { service } = makeService({
      artifact: confirmed(1),
      ticket: openTicket(),
    });

    await expect(service.revokeWriteback('ticket-1')).rejects.toThrow(
      '没有可撤销的回填版本',
    );
  });

  it('最新稿未确认时拒绝撤销', async () => {
    const v1 = confirmed(1);
    const draftV2 = Artifact.create({
      id: 'artifact-2',
      ticketId: 'ticket-1',
      kind: 'clarify',
      version: 2,
      payload: {},
      now: AT,
    });
    const { service } = makeService({
      artifact: [v1, draftV2],
      ticket: openTicket(),
    });

    await expect(service.revokeWriteback('ticket-1')).rejects.toThrow(
      '最新产物未确认',
    );
  });

  it('已结束工单拒绝撤销', async () => {
    const ticket = openTicket();
    ticket.end('结束', AT);
    const { service } = makeService({
      artifact: [confirmed(1), confirmed(2)],
      ticket,
    });

    await expect(service.revokeWriteback('ticket-1')).rejects.toThrow(
      '已结束工单不能撤销回填',
    );
  });
});

describe('GateService 拆解确认', () => {
  it('拆解稿确认后转已确认并通知', async () => {
    const clarify = confirmed(1, { summary: '已确认澄清' });
    const breakdown = Artifact.create({
      id: 'artifact-breakdown',
      ticketId: 'ticket-1',
      kind: 'breakdown',
      version: 1,
      payload: { tasks: [] },
      now: AT,
    });
    const { service, notifier } = makeService({
      artifact: [clarify, breakdown],
      ticket: openTicket(),
    });

    await service.onAttentionAnswered('ticket-1');

    expect(breakdown.status).toBe('confirmed');
    expect(notifier.jobs.some((job) => job.text.includes('拆解稿已确认'))).toBe(
      true,
    );
  });
});

describe('GateService 投机拆解', () => {
  it('确认时优先交付投机拆解稿，不再投递拆解任务', async () => {
    const { service, queue, breakdown } = makeService({
      artifact: draft(),
      ticket: openTicket(),
    });
    breakdown.hasSpeculative = true;

    await service.onAttentionAnswered('ticket-1');

    expect(queue.jobs).toHaveLength(0);
  });

  it('修改时丢弃基于旧澄清稿的投机拆解', async () => {
    const { service, breakdown } = makeService({
      artifact: draft(),
      ticket: openTicket(),
    });

    await service.onAttentionAnswered('ticket-1', 'modify');

    expect(breakdown.discarded).toBe(1);
  });

  it('驳回时丢弃投机拆解', async () => {
    const { service, breakdown } = makeService({ ticket: openTicket() });

    await service.onAttentionAnswered('ticket-1', 'reject', '需求不成立');

    expect(breakdown.discarded).toBe(1);
  });
});

describe('GateService.answerAttention', () => {
  it('同一工单并发回答串行执行闸门推进', async () => {
    const attention = AttentionEntity.create({
      id: 'attention-1',
      ticketId: 'ticket-1',
      kind: 'clarify',
      question: '问题',
      deadline: AT,
      assignee: 'user-1',
      now: AT,
    });
    const { service } = makeService({
      ticket: openTicket(),
      selected: attention,
    });
    const answerService = (
      service as unknown as {
        attentionService: FakeAttentionAnswerService;
      }
    ).attentionService;

    await Promise.all([
      service.answerAttention('attention-1', '答案1', 'reject', '驳回', 'u1'),
      service.answerAttention('attention-1', '答案2', 'reject', '驳回', 'u1'),
    ]);

    expect(answerService.maxActive).toBe(1);
    expect(answerService.calls).toEqual(['attention-1', 'attention-1']);
  });
});

describe('GateService.answerAttention 分布式锁', () => {
  it('工单锁被占用时返回 409 冲突，不推进闸门', async () => {
    const { service } = makeService({
      ticket: openTicket(),
      selected: AttentionEntity.create({
        id: 'attention-1',
        ticketId: 'ticket-1',
        kind: 'clarify',
        question: '问题',
        deadline: AT,
        assignee: 'user-1',
        now: AT,
      }),
      busyLock: true,
    });

    await expect(
      service.answerAttention('attention-1', '答案', 'reject', '驳回', 'u1'),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('重复回答已关闭关注映射为 409', async () => {
    const { service } = makeService({
      selected: AttentionEntity.create({
        id: 'attention-1',
        ticketId: 'ticket-1',
        kind: 'clarify',
        question: '问题',
        deadline: AT,
        assignee: 'user-1',
        now: AT,
      }),
      answerError: new AttentionStateError('closed', '关注已关闭，不能回答'),
    });

    await expect(
      service.answerAttention('attention-1', 'ok', 'confirm', undefined, 'u1'),
    ).rejects.toThrow('关注已关闭，不能回答');
  });
});
