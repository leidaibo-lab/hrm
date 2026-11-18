import { Inject, Injectable, Logger } from '@nestjs/common';
import { env } from '../../../config/env';
import { RedisService } from '../../../platform/redis';
import type { IngressRateLimitPort } from '../domain/ingress-rate-limit.port';

/** 入站事件限速：Redis 固定窗口计数，按来源实例分键。 */
@Injectable()
export class IngressRateLimitService implements IngressRateLimitPort {
  private readonly logger = new Logger(IngressRateLimitService.name);

  constructor(@Inject(RedisService) private readonly redis: RedisService) {}

  /** 尝试获取配额；Redis 不可用时放行并告警（不阻塞接入）。 */
  async tryAcquire(instanceId: string): Promise<boolean> {
    try {
      const key = `ratelimit:ingress:${instanceId}`;
      const replies = await this.redis.withClient((client) =>
        client.multi().incr(key).expire(key, 1).exec(),
      );
      const count = Number(replies?.[0]?.[1] ?? 0);
      return count <= env.INGRESS_RATE_PER_SECOND;
    } catch (cause) {
      this.logger.warn(
        `入站限流不可用，放行: ${
          cause instanceof Error ? cause.message : String(cause)
        }`,
      );
      return true;
    }
  }
}
