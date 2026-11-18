import { MastraServerCache } from '@mastra/core/cache';
import type { RedisService } from '../../../../platform/redis';

/** 缓存键前缀：只清理自身命名空间。 */
const PREFIX = 'agentic:mastra:';

/** Mastra 流式事件缓存：基于 Redis，支持跨进程恢复。 */
export class RedisServerCache extends MastraServerCache {
  constructor(private readonly redis: RedisService) {
    super({ name: 'agentic-redis' });
  }

  /** 读取 JSON 值。 */
  async get(key: string): Promise<unknown> {
    const value = await this.redis.withClient((client) =>
      client.get(`${PREFIX}${key}`),
    );
    return value === null ? undefined : JSON.parse(value);
  }

  /** 写入 JSON 值，支持 TTL。 */
  async set(key: string, value: unknown, ttlMs?: number): Promise<void> {
    const payload = JSON.stringify(value);
    await this.redis.withClient((client) =>
      ttlMs
        ? client.set(`${PREFIX}${key}`, payload, 'PX', ttlMs)
        : client.set(`${PREFIX}${key}`, payload),
    );
  }

  /** 追加列表元素。 */
  async listPush(key: string, value: unknown): Promise<void> {
    await this.redis.withClient((client) =>
      client.rpush(`${PREFIX}${key}`, JSON.stringify(value)),
    );
  }

  /** 读取列表区间。 */
  async listFromTo(key: string, from: number, to?: number): Promise<unknown[]> {
    const rows = await this.redis.withClient((client) =>
      client.lrange(`${PREFIX}${key}`, from, to ?? -1),
    );
    return rows.map((row) => JSON.parse(row));
  }

  /** 列表长度。 */
  async listLength(key: string): Promise<number> {
    return this.redis.withClient((client) => client.llen(`${PREFIX}${key}`));
  }

  /** 删除键。 */
  async delete(key: string): Promise<void> {
    await this.redis.withClient((client) => client.del(`${PREFIX}${key}`));
  }

  /** 清理本命名空间。 */
  async clear(): Promise<void> {
    await this.redis.withClient(async (client) => {
      const stream = client.scanStream({ match: `${PREFIX}*`, count: 100 });
      for await (const keys of stream) {
        if (keys.length > 0) await client.del(...keys);
      }
    });
  }

  /** 原子自增。 */
  async increment(key: string): Promise<number> {
    return this.redis.withClient((client) => client.incr(`${PREFIX}${key}`));
  }
}
