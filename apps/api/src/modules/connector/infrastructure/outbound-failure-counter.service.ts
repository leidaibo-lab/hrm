import { Inject, Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../platform/redis';
import type { OutboundFailureCounterPort } from '../domain/outbound-failure-counter.port';

/** 连续失败计数：Redis 计数，成功即删；保留 24 小时避免长期占用。 */
@Injectable()
export class OutboundFailureCounterService
  implements OutboundFailureCounterPort
{
  private readonly logger = new Logger(OutboundFailureCounterService.name);

  constructor(@Inject(RedisService) private readonly redis: RedisService) {}

  /** 失败计数 +1。 */
  async increment(instanceId: string): Promise<number> {
    try {
      const key = `outbound:fail:${instanceId}`;
      const replies = await this.redis.withClient((client) =>
        client.multi().incr(key).expire(key, 86_400).exec(),
      );
      return Number(replies?.[0]?.[1] ?? 0);
    } catch (cause) {
      this.logger.warn(
        `出站失败计数不可用: ${
          cause instanceof Error ? cause.message : String(cause)
        }`,
      );
      return 0;
    }
  }

  /** 发送成功清零。 */
  async reset(instanceId: string): Promise<void> {
    try {
      await this.redis.withClient((client) =>
        client.del(`outbound:fail:${instanceId}`),
      );
    } catch (cause) {
      this.logger.warn(
        `出站失败计数清零失败: ${
          cause instanceof Error ? cause.message : String(cause)
        }`,
      );
    }
  }
}
