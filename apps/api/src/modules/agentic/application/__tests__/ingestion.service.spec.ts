import { describe, expect, it } from 'vitest';
import type { Thread } from '../../domain/thread.entity';
import type { ThreadRepository } from '../../domain/thread.repository';
import type { Ticket } from '../../domain/ticket.entity';
import type { TicketRepository } from '../../domain/ticket.repository';
import type { Trigger } from '../../domain/trigger.entity';
import type { TriggerRepository } from '../../domain/trigger.repository';
import { IngestionService } from '../ingestion.service';
import { ThreadService } from '../thread.service';

class FakeThreadRepository implements ThreadRepository {
  readonly rows = new Map<string, Thread>();

  async findById(id: string): Promise<Thread | null> {
    return this.rows.get(id) ?? null;
  }

  async findByExternalKey(
    sourceType: string,
    externalKey: string,
  ): Promise<Thread | null> {
    for (const thread of this.rows.values()) {
      if (
        thread.sourceType === sourceType &&
        thread.externalKey === externalKey
      )
        return thread;
    }
    return null;
  }

  async list(): Promise<Thread[]> {
    return [...this.rows.values()];
  }

  async save(thread: Thread): Promise<void> {
    this.rows.set(thread.id, thread);
  }
}

class FakeTriggerRepository implements TriggerRepository {
  readonly rows = new Map<string, Trigger>();

  async findByDedupeKey(dedupeKey: string): Promise<Trigger | null> {
    return this.rows.get(dedupeKey) ?? null;
  }

  async create(trigger: Trigger): Promise<boolean> {
    if (this.rows.has(trigger.dedupeKey)) return false;
    this.rows.set(trigger.dedupeKey, trigger);
    return true;
  }

  async listByThread(): Promise<Trigger[]> {
    return [];
  }

  async listByIds(): Promise<Trigger[]> {
    return [];
  }

  async saveDisposition(trigger: Trigger): Promise<void> {
    this.rows.set(trigger.dedupeKey, trigger);
  }
}

class EmptyTicketRepository implements TicketRepository {
  async findById(): Promise<Ticket | null> {
    return null;
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

const AT = new Date('2026-11-16T00:00:00.000Z');

function makeService(): {
  ingestion: IngestionService;
  threads: FakeThreadRepository;
  triggers: FakeTriggerRepository;
} {
  const threads = new FakeThreadRepository();
  const triggers = new FakeTriggerRepository();
  const threadService = new ThreadService(
    threads,
    triggers,
    new EmptyTicketRepository(),
  );
  return {
    ingestion: new IngestionService(threadService, triggers),
    threads,
    triggers,
  };
}

const input = {
  sourceType: 'lark',
  dedupeKey: 'lark:message-1',
  instanceId: 'instance-1',
  threadKey: 'lark:chat:root',
  scopeKey: 'project-a',
  actorId: 'open-id-1',
  text: '补充验收标准',
  payload: { messageId: 'message-1' },
  occurredAt: AT,
  now: AT,
};

describe('IngestionService.ingest', () => {
  it('首次接入创建线程与事件', async () => {
    const { ingestion, threads, triggers } = makeService();

    const result = await ingestion.ingest(input);

    expect(result.created).toBe(true);
    expect(result.trigger.disposition).toBe('pending');
    expect(result.trigger.threadId).toBe([...threads.rows.keys()][0]);
    expect(triggers.rows.size).toBe(1);
  });

  it('同一幂等键重复接入返回原事件，不重复建线程', async () => {
    const { ingestion, threads, triggers } = makeService();

    const first = await ingestion.ingest(input);
    const second = await ingestion.ingest(input);

    expect(second.created).toBe(false);
    expect(second.trigger.id).toBe(first.trigger.id);
    expect(threads.rows.size).toBe(1);
    expect(triggers.rows.size).toBe(1);
  });

  it('线程键相同的事件归入同一线程', async () => {
    const { ingestion, threads } = makeService();

    const first = await ingestion.ingest(input);
    const second = await ingestion.ingest({
      ...input,
      dedupeKey: 'lark:message-2',
      payload: { messageId: 'message-2' },
    });

    expect(second.trigger.threadId).toBe(first.trigger.threadId);
    expect(threads.rows.size).toBe(1);
  });

  it('接收时间取传入的 now', async () => {
    const { ingestion } = makeService();
    const result = await ingestion.ingest(input);
    expect(result.trigger.receivedAt).toEqual(AT);
  });
});
