import { describe, expect, it } from 'vitest';
import { RecallService } from '../../../../application/recall.service';
import { Thread } from '../../../../domain/thread.entity';
import type { ThreadRepository } from '../../../../domain/thread.repository';
import { Trigger } from '../../../../domain/trigger.entity';
import type { TriggerRepository } from '../../../../domain/trigger.repository';
import { createSearchSimilarTool } from '../search-similar.tool';

const AT = new Date('2026-11-16T00:00:00.000Z');

class FakeThreadRepository implements ThreadRepository {
  constructor(private readonly threads: Thread[]) {}
  async findById(): Promise<Thread | null> {
    return null;
  }
  async findByExternalKey(): Promise<Thread | null> {
    return null;
  }
  async list(): Promise<Thread[]> {
    return this.threads;
  }
  async save(): Promise<void> {}
}

class FakeTriggerRepository implements TriggerRepository {
  constructor(private readonly byThread: Record<string, Trigger[]>) {}
  async findByDedupeKey(): Promise<Trigger | null> {
    return null;
  }
  async create(): Promise<boolean> {
    return true;
  }
  async listByThread(threadId: string): Promise<Trigger[]> {
    return this.byThread[threadId] ?? [];
  }
  async listByIds(): Promise<Trigger[]> {
    return [];
  }
  async saveDisposition(): Promise<void> {}
}

function thread(id: string, summary: string): Thread {
  return Thread.rehydrate({
    id,
    sourceType: 'lark',
    externalKey: id,
    scopeKey: 'chat-1',
    status: 'open',
    summary,
    summaryVersion: 1,
    lastEventAt: AT,
    createdAt: AT,
    updatedAt: AT,
  });
}

function trigger(id: string, threadId: string, text: string): Trigger {
  return Trigger.create({
    id,
    dedupeKey: id,
    sourceType: 'lark',
    instanceId: 'instance-1',
    threadId,
    scopeKey: 'chat-1',
    actorId: 'ou-actor',
    addressed: 'mention',
    text,
    payload: {},
    occurredAt: AT,
    receivedAt: AT,
  });
}

function makeTool(input: {
  threads: FakeThreadRepository;
  triggers: FakeTriggerRepository;
  semantic?: {
    rank: (input: unknown) => Promise<Record<string, number> | null>;
  };
  scopeKey?: string;
}) {
  return createSearchSimilarTool({
    recall: new RecallService(
      input.threads,
      input.triggers,
      input.semantic as never,
    ),
    ...(input.scopeKey ? { scopeKey: input.scopeKey } : {}),
  });
}

async function run(
  tool: ReturnType<typeof createSearchSimilarTool>,
  input: { query: string; limit?: number; excludeThreadId?: string },
): Promise<{
  items: Array<{ threadId: string; score: number }>;
  mode: 'semantic' | 'lexical';
}> {
  const payload = { ...input, limit: input.limit ?? 5 };
  return (await tool.execute?.(payload, undefined as never)) as {
    items: Array<{ threadId: string; score: number }>;
    mode: 'semantic' | 'lexical';
  };
}

describe('search-similar tool', () => {
  it('按词面命中召回并倒序返回', async () => {
    const tool = makeTool({
      threads: new FakeThreadRepository([
        thread('thread-1', '登录失败'),
        thread('thread-2', '导出报表'),
        thread('thread-3', '登录超时'),
      ]),
      triggers: new FakeTriggerRepository({
        'thread-1': [trigger('t1', 'thread-1', '登录失败 需要重试')],
        'thread-2': [trigger('t2', 'thread-2', '导出报表 下载慢')],
        'thread-3': [trigger('t3', 'thread-3', '单点登录 跳转超时')],
      }),
    });

    const result = await run(tool, { query: '登录 超时', limit: 2 });

    expect(result.items).toHaveLength(2);
    expect(result.items[0].score).toBeGreaterThan(0);
    expect(result.items[0].score).toBeGreaterThanOrEqual(result.items[1].score);
  });

  it('排除指定线程且无命中时返回空列表', async () => {
    const tool = makeTool({
      threads: new FakeThreadRepository([thread('thread-1', '无关')]),
      triggers: new FakeTriggerRepository({
        'thread-1': [trigger('t1', 'thread-1', '无关内容')],
      }),
    });

    await expect(
      run(tool, { query: '登录 超时', excludeThreadId: 'thread-1' }),
    ).resolves.toEqual({ items: [], mode: 'lexical' });
  });
});

describe('search-similar tool 权限范围', () => {
  it('只召回同 scope 线程', async () => {
    const tool = makeTool({
      threads: new FakeThreadRepository([thread('thread-1', '登录失败')]),
      triggers: new FakeTriggerRepository({
        'thread-1': [trigger('t1', 'thread-1', '登录失败')],
      }),
      scopeKey: 'chat-2',
    });

    await expect(run(tool, { query: '登录' })).resolves.toEqual({
      items: [],
      mode: 'lexical',
    });
  });

  it('语义端口可用时按模型分数重排', async () => {
    const tool = makeTool({
      threads: new FakeThreadRepository([
        thread('thread-1', '登录失败'),
        thread('thread-2', '登录超时'),
      ]),
      triggers: new FakeTriggerRepository({
        'thread-1': [trigger('t1', 'thread-1', '登录失败')],
        'thread-2': [trigger('t2', 'thread-2', '登录超时')],
      }),
      semantic: {
        rank: async () => ({ 'thread-1': 0.2, 'thread-2': 0.9 }),
      },
    });

    const result = await run(tool, { query: '登录' });

    expect(result.mode).toBe('semantic');
    expect(result.items[0].threadId).toBe('thread-2');
  });

  it('语义端口返回 null 时降级词面匹配', async () => {
    const tool = makeTool({
      threads: new FakeThreadRepository([thread('thread-1', '登录失败')]),
      triggers: new FakeTriggerRepository({
        'thread-1': [trigger('t1', 'thread-1', '登录失败')],
      }),
      semantic: { rank: async () => null },
    });

    const result = await run(tool, { query: '登录' });
    expect(result.mode).toBe('lexical');
    expect(result.items).toHaveLength(1);
  });
});
