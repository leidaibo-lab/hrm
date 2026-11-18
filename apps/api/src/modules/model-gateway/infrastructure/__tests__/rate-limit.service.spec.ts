import { describe, expect, it } from 'vitest';
import type { RedisService } from '../../../../platform/redis';
import { ModelCallError } from '../../domain/model-call.error';
import { RateLimitService } from '../rate-limit.service';

interface FakeChain {
  incr(key: string): FakeChain;
  expire(key: string, seconds: number): FakeChain;
  exec(): Promise<Array<[null, number]>>;
}

function redisWith(counter: () => number): RedisService {
  return {
    withClient: async (
      fn: (client: { multi: () => FakeChain }) => Promise<unknown>,
    ) =>
      fn({
        multi: () => {
          const chain: FakeChain = {
            incr: () => chain,
            expire: () => chain,
            exec: async () => [[null, counter()]],
          };
          return chain;
        },
      }),
  } as unknown as RedisService;
}

describe('RateLimitService', () => {
  it('超过每分钟上限时抛不可重试的 model.rate_limited', async () => {
    let count = 0;
    const service = new RateLimitService(redisWith(() => ++count));

    await expect(service.acquire('provider-1', 1)).resolves.toBeUndefined();
    await expect(service.acquire('provider-1', 1)).rejects.toBeInstanceOf(
      ModelCallError,
    );
    await service.acquire('provider-1', 1).catch((error: unknown) => {
      const failure = error as ModelCallError;
      expect(failure.code).toBe('model.rate_limited');
      expect(failure.isRetryable).toBe(false);
      expect(failure.retryAfterMs).toBeGreaterThan(0);
    });
  });

  it('Redis 故障时 fail-open 放行', async () => {
    const service = new RateLimitService({
      withClient: async () => {
        throw new Error('redis down');
      },
    } as unknown as RedisService);

    await expect(service.acquire('provider-1', 1)).resolves.toBeUndefined();
  });

  it('未配置每分钟上限时不访问 Redis', async () => {
    let called = false;
    const service = new RateLimitService({
      withClient: async () => {
        called = true;
        return undefined;
      },
    } as unknown as RedisService);

    await service.acquire('provider-1', null);
    expect(called).toBe(false);
  });
});
