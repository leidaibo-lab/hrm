import { ERROR_CODE } from '@cip/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../../platform/redis';

/** 限流拒绝：标记 isRetryable=false，防止 mastra 的 maxRetries 形成重试风暴（ADR-0015）。 */
export class ModelRateLimitedError extends Error {
  readonly isRetryable = false;
  readonly code = ERROR_CODE.model.rateLimited;
  constructor(message: string) {
    super(message);
    this.name = 'ModelRateLimitedError';
  }
}

/** 供应商限流参数：null 表示该维度不启用限流。 */
export interface ProviderRateLimitConfig {
  /** 每分钟请求数限制。 */
  rateLimitPerMinute: number | null;
  /** 最大并发数。 */
  maxConcurrent: number | null;
}

const CONCURRENCY_LEASE_SECONDS = 60;
const ACQUIRE_POLL_INTERVAL_MS = 100;
const DEFAULT_ACQUIRE_TIMEOUT_MS = 5000;

/**
 * 供应商级主动限流：Redis 令牌计数（跨 api/worker 进程口径一致）。
 * - 每分钟请求数：固定 60s 窗口计数（窗口切换即轮换，无归还语义）；
 * - 并发数：INCR 抢占 + 60s 租约自愈；acquire 返回是否真实占槽，
 *   仅占槽的调用方才可 release——fail-open 放行不产生借还配对，杜绝计数漂移（回归审查 P1）；
 * - 有界排队：acquire 轮询等待，超时抛 ModelRateLimitedError；
 * - fail-open：Redis 不可用时放行并告警（网关可用性优先，ADR-0015）。
 */
@Injectable()
export class ModelRateLimiter {
  private readonly logger = new Logger(ModelRateLimiter.name);

  constructor(
    @Inject(RedisService)
    private readonly redis: RedisService,
  ) {}

  /**
   * 获取一次调用额度。
   * @returns 是否持有并发槽：true = 调用方必须归还（release）；false = 无需归还
   *         （未配置并发上限，或 Redis 故障 fail-open 放行）。
   * @throws ModelRateLimitedError 超出限流且有界等待超时。
   */
  async acquire(
    providerDbId: string,
    config: ProviderRateLimitConfig,
    timeoutMs = DEFAULT_ACQUIRE_TIMEOUT_MS,
  ): Promise<boolean> {
    if (config.rateLimitPerMinute === null && config.maxConcurrent === null) {
      return false;
    }
    try {
      await this.consumeRequestQuota(providerDbId, config.rateLimitPerMinute);
      return await this.consumeConcurrencySlot(
        providerDbId,
        config.maxConcurrent,
        timeoutMs,
      );
    } catch (cause) {
      if (cause instanceof ModelRateLimitedError) throw cause;
      // Redis 故障 fail-open：放行 + 告警；不占槽（无需归还）
      this.logger.warn(
        `限流器不可用，fail-open 放行: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
      return false;
    }
  }

  /**
   * 归还并发槽；仅限 acquire 返回 true 时调用。
   * Redis 故障时静默（租约到期自愈）。
   */
  async release(providerDbId: string): Promise<void> {
    try {
      await this.redis.withClient((client) =>
        client.decr(this.concurrentKey(providerDbId)),
      );
    } catch {
      // 租约 60s 后自愈
      return;
    }
  }

  private async consumeRequestQuota(
    providerDbId: string,
    rateLimitPerMinute: number | null,
  ): Promise<void> {
    if (rateLimitPerMinute === null) return;
    const window = Math.floor(Date.now() / 60_000);
    const key = `model-rl:rate:${providerDbId}:${window}`;
    // ioredis multi exec 返回元组数组：[[err, incr 结果], [err, expire 结果]]
    const replies = await this.redis.withClient((client) =>
      client.multi().incr(key).expire(key, 60).exec(),
    );
    const used = Number(replies?.[0]?.[1] ?? 0);
    if (used > rateLimitPerMinute) {
      throw new ModelRateLimitedError(
        `服务商请求超出每分钟上限（${rateLimitPerMinute}/min）`,
      );
    }
  }

  private async consumeConcurrencySlot(
    providerDbId: string,
    maxConcurrent: number | null,
    timeoutMs: number,
  ): Promise<boolean> {
    if (maxConcurrent === null) return false;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const key = this.concurrentKey(providerDbId);
      const current = await this.redis.withClient((client) =>
        client.multi().incr(key).expire(key, CONCURRENCY_LEASE_SECONDS).exec(),
      );
      let used = Number(current?.[0]?.[1] ?? 0);
      // 基线钳制：历史漂移产生的负值修复为 0（防止限额被静默放宽）
      if (used < 0) {
        await this.redis.withClient((client) =>
          client.set(key, '0', 'EX', CONCURRENCY_LEASE_SECONDS),
        );
        used = 0;
      }
      if (used <= maxConcurrent) return true;
      await this.redis.withClient((client) => client.decr(key));
      await sleep(ACQUIRE_POLL_INTERVAL_MS);
    }
    throw new ModelRateLimitedError(
      `服务商并发排队超时（上限 ${maxConcurrent}）`,
    );
  }

  private concurrentKey(providerDbId: string): string {
    return `model-rl:conc:${providerDbId}`;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
