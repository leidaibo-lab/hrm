import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { env } from '../../../config/env';
import { RedisService } from '../../../platform/redis';
import type { SessionRepository } from '../domain/session.repository';

const sessionPayloadSchema = z.object({
  userId: z.string(),
  createdAt: z.string(),
});

/**
 * SessionRepository 的 Redis 实现：键设计、TTL 与互踢写序全部收口在此。
 * sid → Redis 会话，固定 TTL；反向索引 auth:user-active:{userId} 指向当前 sid。
 * 会话键与 payload 解析全仓单源于本文件（ADR-0016）。
 */
@Injectable()
export class RedisSessionRepository implements SessionRepository {
  constructor(private readonly redis: RedisService) {}

  /**
   * 建立会话并踢出该账号的既有会话（单设备互踢），被踢设备下一请求即 401。
   * @param userId - 已认证用户 id。
   * @returns 新会话 id（写入 cookie 由 controller 负责）。
   */
  async create(userId: string): Promise<string> {
    const sid = randomUUID();
    const payload = sessionPayloadSchema.parse({
      userId,
      createdAt: new Date().toISOString(),
    });
    await this.redis.withClient(async (client) => {
      // 竞态边界：同账号毫秒级并发登录时非原子序列最坏出现短暂双活，以下一次登录收口
      const previousSid = await client.get(this.activeKey(userId));
      if (previousSid) {
        await client.del(this.key(previousSid));
      }
      await client.set(
        this.key(sid),
        JSON.stringify(payload),
        'EX',
        env.SESSION_TTL_SECONDS,
      );
      await client.set(
        this.activeKey(userId),
        sid,
        'EX',
        env.SESSION_TTL_SECONDS,
      );
    });
    return sid;
  }

  /**
   * 解析会话。
   * @returns userId；会话不存在或载荷非法时为 null。
   */
  async resolve(sid: string): Promise<{ userId: string } | null> {
    const raw = await this.redis.withClient((client) =>
      client.get(this.key(sid)),
    );
    if (!raw) return null;
    const parsed = sessionPayloadSchema.safeParse(JSON.parse(raw));
    return parsed.success ? { userId: parsed.data.userId } : null;
  }

  /**
   * 登出当前设备：删除会话，且仅当其仍是该账号的活跃会话时清掉反向索引，
   * 避免已互踢的旧会话误删新会话的索引。
   */
  async revoke(sid: string): Promise<void> {
    const payload = await this.resolve(sid);
    if (!payload) return;
    await this.redis.withClient(async (client) => {
      if ((await client.get(this.activeKey(payload.userId))) === sid) {
        await client.del(this.activeKey(payload.userId));
      }
      await client.del(this.key(sid));
    });
  }

  private key(sid: string): string {
    return `auth:session:${sid}`;
  }

  private activeKey(userId: string): string {
    return `auth:user-active:${userId}`;
  }
}
