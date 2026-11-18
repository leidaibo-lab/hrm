import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { SourceType } from '../domain/source-adapter.port';
import { SourceInstance } from '../domain/source-instance.entity';
import {
  SOURCE_INSTANCE_REPOSITORY,
  type SourceInstanceRepository,
} from '../domain/source-instance.repository';
import type { SourceRegistry } from './source-registry.service';
import { SOURCE_REGISTRY } from './source-registry.service';

/** 来源实例管理：列表与启停。 */
@Injectable()
export class SourceAdminService {
  constructor(
    @Inject(SOURCE_INSTANCE_REPOSITORY)
    private readonly sources: SourceInstanceRepository,
    @Inject(SOURCE_REGISTRY) private readonly registry: SourceRegistry,
  ) {}

  /** 创建来源实例；配置先经对应适配器校验。 */
  async create(input: {
    sourceType: SourceType;
    name: string;
    config: unknown;
    botId?: string;
  }): Promise<SourceInstance> {
    const adapter = this.registry.get(input.sourceType);
    adapter.validateConfig(input.config);
    const instance = SourceInstance.create({
      id: randomUUID(),
      sourceType: input.sourceType,
      name: input.name,
      config: input.config,
      botId: input.botId,
    });
    await this.sources.save(instance);
    return instance;
  }

  /** 列出实例。 */
  async list(limit = 50): Promise<SourceInstance[]> {
    return this.sources.list(limit);
  }

  /** 修改实例；配置先经适配器校验。 */
  async update(
    id: string,
    input: { name?: string; config?: unknown; botId?: string | null },
    now: Date = new Date(),
  ): Promise<SourceInstance> {
    const instance = await this.sources.findById(id);
    if (!instance) throw new Error(`来源实例不存在：${id}`);
    if (input.config !== undefined) {
      const adapter = this.registry.get(instance.sourceType);
      adapter.validateConfig(input.config);
    }
    instance.reconfigure(input, now);
    await this.sources.save(instance);
    return instance;
  }

  /** 启停实例；不存在报错。 */
  async setEnabled(
    id: string,
    enabled: boolean,
    now: Date = new Date(),
  ): Promise<SourceInstance> {
    const instance = await this.sources.findById(id);
    if (!instance) throw new Error(`来源实例不存在：${id}`);
    if (enabled) instance.enable(now);
    else instance.disable(now);
    await this.sources.save(instance);
    return instance;
  }
}
