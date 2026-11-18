import { ERROR_CODE } from '@cip/shared';
import { HttpException, Inject, Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../platform/redis';

/** 固定窗口限流参数：窗口内允许的最大次数。 */
export interface RateLimitRule {
  /** 窗口内允许的最大请求次数。 */
  limit: number;
  /** 窗口长度（秒）。 */
  windowSeconds: number;
}

/**
 * 固定窗口限流（横切能力）：经 Redis INCR 计数，超出阈值抛 429。
 * - 键由调用方构造（如 login:{ip}），INCR 与 EXPIRE 经 multi 原子执行，
 *   杜绝「计数成功、过期未设」导致键永不过期、对应维度永久 429；
 * - fail-open：Redis 不可用时放行并告警（与 model-rate-limiter 策略一致，
 *   ADR-0015；RedisService 的 retryStrategy=null 保证命令不会排队挂起）。
 */
@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);

  constructor(
    @Inject(RedisService)
    private readonly redis: RedisService,
  ) {}

  /**
   * 断言指定键在窗口内未超限；超限抛 429 auth.too_many_attempts。
   * Redis 不可用时放行（fail-open）并告警，不阻塞登录/注册主流程。
   * @param key - 限流维度键（已含 scope 前缀，如 login:1.2.3.4）。
   */
  async assertWithin(key: string, rule: RateLimitRule): Promise<void> {
    let count: number;
    try {
      const cacheKey = `ratelimit:${key}`;
      // ioredis multi exec 返回元组数组：[[err, incr 结果], [err, expire 结果]]
      const replies = await this.redis.withClient((client) =>
        client
          .multi()
          .incr(cacheKey)
          .expire(cacheKey, rule.windowSeconds)
          .exec(),
      );
      count = Number(replies?.[0]?.[1] ?? 0);
    } catch (cause) {
      this.logger.warn(
        `限流器不可用，fail-open 放行: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
      return;
    }
    if (count > rule.limit) {
      throw new HttpException(
        {
          code: ERROR_CODE.auth.tooManyAttempts,
          message: '尝试过于频繁，请稍后再试',
        },
        429,
      );
    }
  }
}
