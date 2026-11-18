import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { PrismaService } from '../../../platform/prisma';
import type { RedisService } from '../../../platform/redis';
import { HealthLivenessController } from '../liveness.controller';
import { HealthReadinessController } from '../readiness.controller';

function readinessWith(dbUp: boolean, redisUp: boolean) {
  return new HealthReadinessController(
    { probeDb: async () => dbUp } as unknown as PrismaService,
    { probeRedis: async () => redisUp } as unknown as RedisService,
  );
}

describe('HealthLivenessController', () => {
  it('存活探针返回 ok 与 uptime', () => {
    const result = new HealthLivenessController().getLiveness();
    expect(result.status).toBe('ok');
    expect(result.uptime).toBeGreaterThan(0);
  });
});

describe('HealthReadinessController', () => {
  it('依赖就绪时返回 ready', async () => {
    await expect(readinessWith(true, true).getReadiness()).resolves.toEqual({
      status: 'ready',
      checks: { db: 'up', redis: 'up' },
    });
  });

  it('数据库不可用时 503 health.db_unavailable', async () => {
    const error = await readinessWith(false, true)
      .getReadiness()
      .catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getResponse()).toMatchObject({
      code: 'health.db_unavailable',
    });
  });

  it('Redis 不可用时 503 health.redis_unavailable', async () => {
    const error = await readinessWith(true, false)
      .getReadiness()
      .catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getResponse()).toMatchObject({
      code: 'health.redis_unavailable',
    });
  });
});
