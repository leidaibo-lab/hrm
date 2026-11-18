import { Inject, Injectable, Logger } from '@nestjs/common';
import type { HealthState } from '../domain/source-health.entity';
import { SourceHealth } from '../domain/source-health.entity';
import {
  SOURCE_HEALTH_REPOSITORY,
  type SourceHealthRepository,
} from '../domain/source-health.repository';

/** 源健康读取。 */
@Injectable()
export class SourceHealthService {
  private readonly logger = new Logger(SourceHealthService.name);

  constructor(
    @Inject(SOURCE_HEALTH_REPOSITORY)
    private readonly health: SourceHealthRepository,
  ) {}

  /** 列出实例健康条目。 */
  async list(instanceId: string): Promise<SourceHealth[]> {
    return this.health.listByInstance(instanceId);
  }

  /** 更新健康状态；健康写入失败不影响主流程。 */
  async mark(
    instanceId: string,
    entry: string,
    state: HealthState,
    detail: string | null = null,
    now: Date = new Date(),
  ): Promise<void> {
    try {
      const existing = await this.health.find(instanceId, entry);
      if (existing) {
        existing.mark(state, detail, now);
        await this.health.save(existing);
        return;
      }
      await this.health.save(
        SourceHealth.create({ instanceId, entry, state, detail, now }),
      );
    } catch (error) {
      this.logger.warn(
        `健康状态写入失败：${error instanceof Error ? error.message : '未知错误'}`,
      );
    }
  }
}
