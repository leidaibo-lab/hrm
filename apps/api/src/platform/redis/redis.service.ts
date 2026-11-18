import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import IORedis, { type Redis } from 'ioredis';
import { env } from '../../config/env';

/**
 * 缓存与锁适配器：会话存储经此访问 Redis（与队列适配器同用 ioredis，统一客户端栈）。
 * 惰性连接：进程启动不依赖 Redis 在场，首次使用时连接；连接失败抛给调用方，
 * healthz 保持可启动，readyz 显式探测。
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis = this.createClient();
  private connectPromise?: Promise<void>;

  /**
   * 连接失败即终止（retryStrategy 返回 null）：connect() reject 抛给调用方，
   * 是限流器 fail-open 的前提——ioredis 默认无限重连会让命令排队挂起，fail-open 无法生效。
   * 断线后由 ensureConnected 重建客户端实现下次使用时重试。
   */
  private createClient(): Redis {
    return new IORedis(env.REDIS_URL, {
      lazyConnect: true,
      retryStrategy: () => null,
    });
  }

  /**
   * 以受控回调暴露客户端：连接保证一次且幂等，调用方不直接触碰连接生命周期。
   * @param fn - 使用已连接客户端执行的操作。
   */
  async withClient<T>(fn: (client: Redis) => Promise<T>): Promise<T> {
    await this.ensureConnected();
    return fn(this.client);
  }

  /**
   * 探测 Redis 可用性，超时按不可用处理。
   * @param timeoutMs - 等待 PING 响应的上限毫秒数。
   * @returns 可达为 true；超时或失败为 false，不抛出。
   */
  async probeRedis(timeoutMs = 1000): Promise<boolean> {
    try {
      await Promise.race([
        this.withClient((client) => client.ping()),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), timeoutMs),
        ),
      ]);
      return true;
    } catch (cause) {
      this.logger.warn(
        `Redis 健康检查失败: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
      return false;
    }
  }

  private ensureConnected(): Promise<void> {
    if (this.client.status === 'end') {
      // 上次连接失败已终止：重建客户端允许下次重试，避免缓存一次失败导致永久不可用
      this.client.disconnect();
      this.client = this.createClient();
    }
    if (!this.connectPromise) {
      this.connectPromise = this.client
        .connect()
        .then(() => {
          this.logger.log('Redis 已连接');
        })
        .catch((cause: unknown) => {
          // 失败后允许下次重试，避免缓存一次失败导致永久不可用
          this.connectPromise = undefined;
          throw cause;
        });
    }
    return this.connectPromise;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.connectPromise) {
      await this.client.quit().catch(() => undefined);
    }
  }
}
