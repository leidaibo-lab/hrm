import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../platform/redis';
import type {
  TicketLockHandle,
  TicketLockPort,
} from '../domain/ticket-lock.port';

/** 锁 TTL：覆盖一次回答+闸门推进，超时自动释放避免死锁。 */
const LOCK_TTL_MS = 30_000;

/** 释放锁的 Lua：仅当值匹配时删除，避免误删他实例的锁。 */
const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

/** 工单级 Redis 互斥锁：SET NX PX + 值校验释放。 */
@Injectable()
export class TicketRedisLockService implements TicketLockPort {
  private readonly logger = new Logger(TicketRedisLockService.name);

  constructor(@Inject(RedisService) private readonly redis: RedisService) {}

  /** 尝试获取锁；Redis 故障时降级为 no-op（fail-open）并告警。 */
  async acquire(ticketId: string): Promise<TicketLockHandle | null> {
    const key = `agentic:ticket-lock:${ticketId}`;
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
              `工单锁释放失败: ${
                cause instanceof Error ? cause.message : String(cause)
              }`,
            );
          }
        },
      };
    } catch (cause) {
      this.logger.warn(
        `工单锁不可用，降级放行: ${
          cause instanceof Error ? cause.message : String(cause)
        }`,
      );
      return { release: async () => undefined };
    }
  }
}
