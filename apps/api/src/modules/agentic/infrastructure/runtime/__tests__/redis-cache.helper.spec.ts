import { describe, expect, it } from 'vitest';
import type { RedisService } from '../../../../../platform/redis';
import { RedisServerCache } from '../redis-cache.helper';

class FakeRedis {
  readonly values = new Map<string, string>();
  readonly lists = new Map<string, string[]>();
  readonly counters = new Map<string, number>();

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }
  async set(
    key: string,
    value: string,
    _mode?: string,
    _ttl?: number,
  ): Promise<'OK'> {
    this.values.set(key, value);
    return 'OK';
  }
  async del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const key of keys) {
      if (this.values.delete(key)) removed += 1;
      if (this.lists.delete(key)) removed += 1;
    }
    return removed;
  }
  async rpush(key: string, value: string): Promise<number> {
    const list = this.lists.get(key) ?? [];
    list.push(value);
    this.lists.set(key, list);
    return list.length;
  }
  async lrange(key: string, from: number, to: number): Promise<string[]> {
    const list = this.lists.get(key) ?? [];
    return list.slice(from, to === -1 ? undefined : to + 1);
  }
  async llen(key: string): Promise<number> {
    return (this.lists.get(key) ?? []).length;
  }
  async incr(key: string): Promise<number> {
    const next = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, next);
    return next;
  }
  scanStream(): AsyncIterable<string[]> {
    return {
      async *[Symbol.asyncIterator]() {
        yield [];
      },
    };
  }
}

function makeCache(): { cache: RedisServerCache; client: FakeRedis } {
  const client = new FakeRedis();
  const redis = {
    withClient: async <T>(fn: (client: FakeRedis) => Promise<T>) => fn(client),
  } as unknown as RedisService;
  return { cache: new RedisServerCache(redis), client };
}

describe('RedisServerCache', () => {
  it('JSON 存取与删除', async () => {
    const { cache, client } = makeCache();
    await cache.set('k', { a: 1 });
    expect(await cache.get('k')).toEqual({ a: 1 });
    expect(client.values.has('agentic:mastra:k')).toBe(true);
    await cache.delete('k');
    expect(await cache.get('k')).toBeUndefined();
  });

  it('列表读写与长度', async () => {
    const { cache } = makeCache();
    await cache.listPush('list', { index: 1 });
    await cache.listPush('list', { index: 2 });
    expect(await cache.listFromTo('list', 0)).toEqual([
      { index: 1 },
      { index: 2 },
    ]);
    expect(await cache.listLength('list')).toBe(2);
  });

  it('原子自增', async () => {
    const { cache } = makeCache();
    expect(await cache.increment('counter')).toBe(1);
    expect(await cache.increment('counter')).toBe(2);
  });
});
