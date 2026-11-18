import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../platform/redis';
import type { EvalLockHandle, EvalLockPort } from '../domain/eval-lock.port';

/** 锁 TTL：覆盖一次评估（模型调用+写库），超时自动释放避免死锁。 */
const LOCK_TTL_MS = 120_000;

/** 释放锁 Lua：值匹配才删除，避免误删他实例锁。 */
const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

/** 线程级 Eval 锁：Redis SET NX PX + 值校验释放。 */
@Injectable()
export class EvalRedisLockService implements EvalLockPort {
  private readonly logger = new Logger(EvalRedisLockService.name);

  constructor(@Inject(RedisService) private readonly redis: RedisService) {}

  /** 尝试获取线程锁；Redis 故障时降级为 no-op 并告警。 */
  async tryAcquire(threadId: string): Promise<EvalLockHandle | null> {
    const key = `agentic:eval-lock:${threadId}`;
    const token = randomUUID();
    try {
      const claimed = await this.redis.withClient((client) =>
        client.set(key, token, 'PX', LOCK_TTL_MS, 'NX'),
      );
      if (claimed === null) return null;
      return {
        release: async () => {
          try {
            await this.redis.withClient((client) =>
              client.eval(RELEASE_SCRIPT, 1, key, token),
            );
          } catch (cause) {
            this.logger.warn(
              `Eval 锁释放失败: ${
                cause instanceof Error ? cause.message : String(cause)
              }`,
            );
          }
        },
      };
    } catch (cause) {
      this.logger.warn(
        `Eval 锁不可用，降级放行: ${
          cause instanceof Error ? cause.message : String(cause)
        }`,
      );
      return { release: async () => undefined };
    }
  }
}
