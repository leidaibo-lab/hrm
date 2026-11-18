import { describe, expect, it } from 'vitest';
import { RedisService } from '../../../../platform/redis';
import { RedisSessionRepository } from '../session.redis.repository';

/** 内存键值模拟 Redis 命令面：验证互踢与索引维护的调用语义。 */
class FakeRedis {
  store = new Map<string, string>();
  private client = {
    get: async (key: string) => this.store.get(key) ?? null,
    // ioredis set 签名：set(key, value, 'EX', ttlSeconds)
    set: async (key: string, value: string, _mode?: 'EX', _ttl?: number) => {
      this.store.set(key, value);
    },
    del: async (...keys: string[]) => {
      for (const key of keys) this.store.delete(key);
    },
  };

  async withClient<T>(
    fn: (client: typeof this.client) => Promise<T>,
  ): Promise<T> {
    return fn(this.client);
  }
}

function makeRepository() {
  const fake = new FakeRedis();
  return {
    fake,
    repository: new RedisSessionRepository(fake as unknown as RedisService),
  };
}

describe('RedisSessionRepository（单设备互踢）', () => {
  it('create 写入会话与活跃索引', async () => {
    const { fake, repository } = makeRepository();
    const sid = await repository.create('u1');
    expect(fake.store.get(`auth:session:${sid}`)).toContain('u1');
    expect(fake.store.get('auth:user-active:u1')).toBe(sid);
  });

  it('同一账号再次登录踢出旧会话：旧 sid 解析为 null，索引指向新 sid', async () => {
    const { repository } = makeRepository();
    const old = await repository.create('u1');
    const fresh = await repository.create('u1');
    expect(await repository.resolve(old)).toBeNull();
    expect(await repository.resolve(fresh)).toEqual({ userId: 'u1' });
  });

  it('revoke 当前活跃会话：会话与索引一并清除', async () => {
    const { fake, repository } = makeRepository();
    const sid = await repository.create('u1');
    await repository.revoke(sid);
    expect(fake.store.has(`auth:session:${sid}`)).toBe(false);
    expect(fake.store.has('auth:user-active:u1')).toBe(false);
  });

  it('revoke 已被互踢的旧会话：不误删新会话的索引', async () => {
    const { fake, repository } = makeRepository();
    const old = await repository.create('u1');
    const fresh = await repository.create('u1');
    await repository.revoke(old);
    expect(fake.store.get('auth:user-active:u1')).toBe(fresh);
    expect(fake.store.has(`auth:session:${fresh}`)).toBe(true);
  });

  it('旧索引残留但会话已过期时 create 正常收口', async () => {
    const { fake, repository } = makeRepository();
    await repository.create('u1');
    // 模拟会话自然过期：session 键消失，active 索引残留
    const activeSid = fake.store.get('auth:user-active:u1') as string;
    fake.store.delete(`auth:session:${activeSid}`);
    const fresh = await repository.create('u1');
    expect(await repository.resolve(fresh)).toEqual({ userId: 'u1' });
    expect(fake.store.get('auth:user-active:u1')).toBe(fresh);
  });
});
