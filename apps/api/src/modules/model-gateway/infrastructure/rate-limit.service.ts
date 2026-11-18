import { Inject, Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../platform/redis';
import { ModelCallError } from '../domain/model-call.error';
import type { RateLimitPort } from '../domain/runtime.port';

/** 固定窗口秒数：按自然分钟计数，窗口切换即重新计数。 */
const WINDOW_SECONDS = 61;

/**
 * 供应商每分钟限流：Redis 固定窗口计数（跨 api/worker 进程口径一致）。
 * Redis 故障 fail-open 放行并告警；超限抛 model.rate_limited 且不可重试，
 * 防止 mastra 在链内形成重试风暴。
 */
@Injectable()
export class RateLimitService implements RateLimitPort {
  private readonly logger = new Logger(RateLimitService.name);

  constructor(
    @Inject(RedisService)
    private readonly redis: RedisService,
  ) {}

  async acquire(
    providerId: string,
    limitPerMinute: number | null,
  ): Promise<void> {
    if (limitPerMinute === null) return;
    try {
      const window = Math.floor(Date.now() / 60_000);
      const key = `model-gateway:rl:rate:${providerId}:${window}`;
      const replies = await this.redis.withClient((client) =>
        client.multi().incr(key).expire(key, WINDOW_SECONDS).exec(),
      );
      const used = Number(replies?.[0]?.[1] ?? 0);
      if (used > limitPerMinute) {
        const retryAfterMs = Math.max(1, 60_000 - (Date.now() % 60_000));
        throw new ModelCallError(
          'model.rate_limited',
          `服务商请求超出每分钟上限（${limitPerMinute}/min）`,
          false,
          retryAfterMs,
        );
      }
    } catch (cause) {
      if (cause instanceof ModelCallError) throw cause;
      this.logger.warn(
        '限流器不可用，fail-open 放行: ' +
          (cause instanceof Error ? cause.message : String(cause)),
      );
    }
  }
}
