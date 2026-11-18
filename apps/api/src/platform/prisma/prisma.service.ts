import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../../config/env';
import { PrismaClient } from './generated/client';

/**
 * 数据库适配器：Prisma 7 经 driver adapter（@prisma/adapter-pg）建立连接。
 * 骨架阶段不做模块初始化自动连接：healthz 必须在数据库缺席时仍可启动，
 * 数据库可用性由 readyz 显式探测。
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
  }

  /**
   * 探测数据库可用性，超时按不可用处理。
   * @param timeoutMs - 等待数据库响应的上限毫秒数。
   * @returns 数据库可达为 true；超时或查询失败为 false，不抛出。
   */
  async probeDb(timeoutMs = 1000): Promise<boolean> {
    try {
      await Promise.race([
        this.$queryRaw`SELECT 1`,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), timeoutMs),
        ),
      ]);
      return true;
    } catch (error) {
      this.logger.warn(`数据库健康检查失败: ${String(error)}`);
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
