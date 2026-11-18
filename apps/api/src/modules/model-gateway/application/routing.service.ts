import { Inject, Injectable } from '@nestjs/common';
import type { ModelCapabilityRequirement } from '../domain/candidate.entity';
import { ModelCallError } from '../domain/model-call.error';
import {
  BREAKER_PORT,
  type BreakerPort,
  type RoutingSnapshot,
  SNAPSHOT_PORT,
  type SnapshotPort,
} from '../domain/runtime.port';

/** mastra 消费的候选链条目（结构兼容 ModelWithRetries）。 */
export interface ChainEntry {
  /** 候选主键，供日志与用量关联。 */
  id: string;
  /** mastra 模型串：cip/<slug>/<modelId>。 */
  model: string;
  /** 同模型重试次数；网关固定为 0，避免与 fallback 叠加。 */
  maxRetries: number;
}

/** 路由应用服务：快照 → 过滤 → 排序 → 截断。 */
@Injectable()
export class RoutingService {
  constructor(
    @Inject(SNAPSHOT_PORT)
    private readonly snapshot: SnapshotPort,
    @Inject(BREAKER_PORT)
    private readonly breaker: BreakerPort,
  ) {}

  async resolveChain(
    logicalKey: string,
    requirement: ModelCapabilityRequirement,
  ): Promise<ChainEntry[]> {
    const snapshot: RoutingSnapshot = await this.snapshot.get();
    const logical = snapshot.logicalByKey.get(logicalKey);
    if (!logical) {
      throw new ModelCallError(
        'model.logical_model_not_found',
        '逻辑模型 ' + logicalKey + ' 未注册',
        false,
      );
    }
    const at = Date.now();
    const candidates = (
      snapshot.candidatesByLogical.get(logical.id) ?? []
    ).filter((entry) => this.breaker.allows(entry.providerId, at));
    const chain = logical.resolveChain(candidates, {
      at: new Date(at),
      requirement,
      maxAttempts: logical.maxAttempts,
    });
    return chain.map((entry) => ({
      id: entry.id,
      model: 'cip/' + entry.providerSlug + '/' + entry.providerModelId,
      maxRetries: 0,
    }));
  }
}
