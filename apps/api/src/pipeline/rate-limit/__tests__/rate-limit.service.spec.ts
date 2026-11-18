import { ERROR_CODE } from '@cip/shared';
import { HttpException, Logger } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { RedisService } from '../../../platform/redis';
import { RateLimitService } from '../rate-limit.service';

const RULE = { limit: 3, windowSeconds: 60 };

/** 手写 fake 只打在 Redis 架构边界（TST 替身纪律）；记录 multi 调用链，exec 返回 ioredis 元组数组形态。 */
function redisFake(exec: () => Promise<Array<[unknown, unknown]>>) {
  const calls: string[] = [];
  const multi = {
    incr: (key: string) => {
      calls.push(`incr:${key}`);
      return multi;
    },
    expire: (key: string) => {
      calls.push(`expire:${key}`);
      return multi;
    },
    exec,
  };
  const client = { multi: () => multi };
  const service = {
    withClient: (fn: (client: unknown) => Promise<unknown>) => fn(client),
  };
  return { fake: service as unknown as RedisService, calls };
}

/** 固定窗口限流：multi 原子写、超限 429、Redis 故障 fail-open 告警。 */
describe('RateLimitService', () => {
  it('窗口内未超限放行', async () => {
    const { fake } = redisFake(async () => [
      [null, 2],
      [null, 'OK'],
    ]);
    const service = new RateLimitService(fake);
    await expect(
      service.assertWithin('login:1.2.3.4', RULE),
    ).resolves.toBeUndefined();
  });

  it('超出窗口上限抛 429 auth.too_many_attempts', async () => {
    const { fake } = redisFake(async () => [
      [null, 4],
      [null, 'OK'],
    ]);
    const service = new RateLimitService(fake);
    const error = await service.assertWithin('login:1.2.3.4', RULE).then(
      () => null,
      (cause: unknown) => cause,
    );
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(429);
    expect((error as HttpException).getResponse()).toMatchObject({
      code: ERROR_CODE.auth.tooManyAttempts,
    });
  });

  it('INCR 与 EXPIRE 在同一 multi 上原子执行', async () => {
    const { fake, calls } = redisFake(async () => [
      [null, 1],
      [null, 'OK'],
    ]);
    const service = new RateLimitService(fake);
    await service.assertWithin('login:1.2.3.4', RULE);
    expect(calls).toEqual([
      'incr:ratelimit:login:1.2.3.4',
      'expire:ratelimit:login:1.2.3.4',
    ]);
  });

  it('Redis 故障 fail-open 放行并告警，不阻塞主流程', async () => {
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const { fake } = redisFake(async () => {
      throw new Error('connection refused');
    });
    const service = new RateLimitService(fake);
    await expect(
      service.assertWithin('login:1.2.3.4', RULE),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
