import { describe, expect, it } from 'vitest';
import type { Thread } from '../../domain/thread.entity';
import type { ThreadRepository } from '../../domain/thread.repository';
import type { Ticket } from '../../domain/ticket.entity';
import type { TicketRepository } from '../../domain/ticket.repository';
import type { Trigger } from '../../domain/trigger.entity';
import type { TriggerRepository } from '../../domain/trigger.repository';
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

class EmptyTriggerRepository implements TriggerRepository {
  async findByDedupeKey(): Promise<Trigger | null> {
    return null;
  }
  async create(): Promise<boolean> {
    return true;
  }
  async listByThread(): Promise<Trigger[]> {
    return [];
  }
  async listByIds(): Promise<Trigger[]> {
    return [];
  }

  async saveDisposition(): Promise<void> {}
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

describe('ThreadService.ensureOpen', () => {
  it('首次按外部键开启并保存线程', async () => {
    const repository = new FakeThreadRepository();
    const service = new ThreadService(
      repository,
      new EmptyTriggerRepository(),
      new EmptyTicketRepository(),
    );

    const thread = await service.ensureOpen({
      sourceType: 'lark',
      externalKey: 'lark:chat:root',
      scopeKey: 'project-a',
      now: AT,
    });

    expect(thread.status).toBe('open');
    expect(thread.scopeKey).toBe('project-a');
    expect(repository.rows.size).toBe(1);
  });

  it('同一外部键重复调用返回同一线程，不重复创建', async () => {
    const repository = new FakeThreadRepository();
    const service = new ThreadService(
      repository,
      new EmptyTriggerRepository(),
      new EmptyTicketRepository(),
    );

    const first = await service.ensureOpen({
      sourceType: 'lark',
      externalKey: 'lark:chat:root',
      now: AT,
    });
    const second = await service.ensureOpen({
      sourceType: 'lark',
      externalKey: 'lark:chat:root',
      now: AT,
    });

    expect(second.id).toBe(first.id);
    expect(repository.rows.size).toBe(1);
  });

  it('未提供 scopeKey 时落为 null', async () => {
    const repository = new FakeThreadRepository();
    const service = new ThreadService(
      repository,
      new EmptyTriggerRepository(),
      new EmptyTicketRepository(),
    );

    const thread = await service.ensureOpen({
      sourceType: 'zentao',
      externalKey: 'zentao:a:bug:1',
      now: AT,
    });

    expect(thread.scopeKey).toBeNull();
  });

  it('并发首见同一外部键时回查已创建线程', async () => {
    class RacingRepository extends FakeThreadRepository {
      private failed = false;
      override async save(thread: Thread): Promise<void> {
        if (!this.failed) {
          this.failed = true;
          this.rows.set('winner', thread);
          throw new Error('Unique constraint failed');
        }
        await super.save(thread);
      }
    }
    const repository = new RacingRepository();
    const service = new ThreadService(
      repository,
      new EmptyTriggerRepository(),
      new EmptyTicketRepository(),
    );

    const thread = await service.ensureOpen({
      sourceType: 'lark',
      externalKey: 'lark:chat:root',
      now: AT,
    });

    expect(thread.externalKey).toBe('lark:chat:root');
    expect(repository.rows.size).toBe(1);
  });
});
