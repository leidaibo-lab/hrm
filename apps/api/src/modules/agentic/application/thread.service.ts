import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Thread } from '../domain/thread.entity';
import {
  THREAD_REPOSITORY,
  type ThreadRepository,
} from '../domain/thread.repository';
import type { Ticket } from '../domain/ticket.entity';
import {
  TICKET_REPOSITORY,
  type TicketRepository,
} from '../domain/ticket.repository';
import type { Trigger } from '../domain/trigger.entity';
import {
  TRIGGER_REPOSITORY,
  type TriggerRepository,
} from '../domain/trigger.repository';

/** 线程详情：线程 + 事件 + 工单。 */
export interface ThreadDetail {
  /** 线程。 */
  thread: Thread;
  /** 线程事件。 */
  triggers: Trigger[];
  /** 线程工单。 */
  tickets: Ticket[];
}

/** 取回或开启线程的输入。 */
export interface EnsureThreadInput {
  /** 来源类型（lark/zentao/gitlab）。 */
  sourceType: string;
  /** 来源内稳定线程键。 */
  externalKey: string;
  /** 项目或空间标识。 */
  scopeKey?: string | null;
  /** 当前时间；缺省为系统时间。 */
  now?: Date;
}

/** 线程用例：按外部键幂等地取回或开启线程。 */
@Injectable()
export class ThreadService {
  constructor(
    @Inject(THREAD_REPOSITORY) private readonly threads: ThreadRepository,
    @Inject(TRIGGER_REPOSITORY) private readonly triggers: TriggerRepository,
    @Inject(TICKET_REPOSITORY) private readonly tickets: TicketRepository,
  ) {}

  /** 列出最近线程。 */
  async list(limit = 50, scopeKeys?: string[]): Promise<Thread[]> {
    return this.threads.list(limit, scopeKeys);
  }

  /** 按来源与外部键取线程详情；不存在返回 null。 */
  async detailByKey(
    sourceType: string,
    externalKey: string,
  ): Promise<ThreadDetail | null> {
    const thread = await this.threads.findByExternalKey(
      sourceType,
      externalKey,
    );
    if (!thread) return null;
    const [triggers, tickets] = await Promise.all([
      this.triggers.listByThread(thread.id),
      this.tickets.listByThread(thread.id),
    ]);
    return { thread, triggers, tickets };
  }

  /** 按来源与外部键取回线程；不存在则开启并保存。 */
  async ensureOpen(input: EnsureThreadInput): Promise<Thread> {
    const existing = await this.threads.findByExternalKey(
      input.sourceType,
      input.externalKey,
    );
    if (existing) return existing;

    const thread = Thread.open({
      id: randomUUID(),
      sourceType: input.sourceType,
      externalKey: input.externalKey,
      scopeKey: input.scopeKey ?? null,
      now: input.now,
    });
    try {
      await this.threads.save(thread);
      return thread;
    } catch (error) {
      // 并发首见同一外部键：另一请求已创建，回查并复用胜者。
      const raced = await this.threads.findByExternalKey(
        input.sourceType,
        input.externalKey,
      );
      if (raced) return raced;
      throw error;
    }
  }
}
