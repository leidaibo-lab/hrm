import type {
  GatewayLanguageModel,
  MastraModelGateway,
} from '@mastra/core/llm';
import { Inject, Injectable } from '@nestjs/common';
import type { ModelCapabilityRequirement } from '../domain/candidate.entity';
import { ModelCallError } from '../domain/model-call.error';
import {
  GATEWAY_RUNTIME_PORT,
  type GatewayRuntimePort,
  SNAPSHOT_PORT,
  type SnapshotPort,
} from '../domain/runtime.port';
import { RoutingService } from './routing.service';

/** 调用归因：缺失字段显式为空，不影响解析与计量。 */
export interface ModelAttribution {
  /** 空间标识。 */
  spaceId?: string;
  /** 智能体标识。 */
  agentKey?: string;
  /** 调用方。 */
  caller?: string;
  /** 链路追踪标识。 */
  traceId?: string;
}

/** mastra 消费的候选链：id 为 candidateId，每条禁用自动重试。 */
export interface ModelWithRetries {
  /** 记录标识。 */
  id: string;
  /** 模型调用名。 */
  model: string;
  /** 最大重试次数。 */
  maxRetries: number;
}

/** 供应商健康读模型：降级/熔断状态供调度器与页面消费。 */
export interface ProviderHealthView {
  /** 供应商标识。 */
  providerId: string;
  /** 短标识。 */
  slug: string;
  /** 是否启用。 */
  enabled: boolean;
  /** 健康状态。 */
  health: string;
  /** 熔断截止时间。 */
  openUntil: string | null;
  /** 是否可路由。 */
  routable: boolean;
}

/**
 * 跨域唯一模型接入面（ADR-0084）：
 * createGateway / resolveModelChain / resolveModel / supportsCapability / getProviderHealth。
 * 除本服务外，其他模块不得触达 mastra 与网关内部。
 */
@Injectable()
export class GatewayExportService {
  constructor(
    @Inject(GATEWAY_RUNTIME_PORT)
    private readonly runtime: GatewayRuntimePort<
      MastraModelGateway,
      GatewayLanguageModel
    >,
    @Inject(SNAPSHOT_PORT)
    private readonly snapshot: SnapshotPort,
    private readonly routing: RoutingService,
  ) {}

  async createGateway(): Promise<MastraModelGateway> {
    return this.runtime.createGateway();
  }

  /** 解析候选链；attribution 只用于后续计量，不参与选择。 */
  async resolveModelChain(
    logicalKey: string,
    requirement: ModelCapabilityRequirement,
    _attribution?: ModelAttribution,
  ): Promise<ModelWithRetries[]> {
    const chain = await this.routing.resolveChain(logicalKey, requirement);
    return chain.map((entry) => ({
      id: entry.id,
      model: entry.model,
      maxRetries: 0,
    }));
  }

  /** 直调单候选：无 fallback；不满足能力或没有候选时抛 ModelCallError。 */
  async resolveModel(
    logicalKey: string,
    _attribution?: ModelAttribution,
  ): Promise<GatewayLanguageModel> {
    const snapshot = await this.snapshot.get();
    const logical = snapshot.logicalByKey.get(logicalKey);
    if (!logical) {
      throw new ModelCallError(
        'model.logical_model_not_found',
        `逻辑模型 ${logicalKey} 未注册`,
        false,
      );
    }
    const candidates = snapshot.candidatesByLogical.get(logical.id) ?? [];
    const chain = logical.resolveChain(candidates, {
      at: new Date(),
      requirement: {},
      maxAttempts: logical.maxAttempts,
    });
    const model = await this.runtime.resolveModel(chain[0]);
    if (!model) {
      throw new ModelCallError(
        'model.provider_unavailable',
        `候选 ${chain[0].id} 无法解析为模型实例`,
        false,
      );
    }
    return model;
  }

  /** 能力前置校验：逻辑模型停用、无候选或能力不满足均返回 false。 */
  async supportsCapability(
    logicalKey: string,
    requirement: ModelCapabilityRequirement,
  ): Promise<boolean> {
    try {
      return (
        (await this.routing.resolveChain(logicalKey, requirement)).length > 0
      );
    } catch {
      return false;
    }
  }

  /** 供应商健康：enabled 与 health 正交，openUntil 以 UTC 字符串返回。 */
  async getProviderHealth(): Promise<ProviderHealthView[]> {
    const snapshot = await this.snapshot.get();
    const now = new Date();
    return [...snapshot.providers.values()].map((provider) => ({
      providerId: provider.id,
      slug: provider.slug,
      enabled: provider.enabled,
      health: provider.health,
      openUntil: provider.openUntil?.toISOString() ?? null,
      routable: provider.isRoutable(now),
    }));
  }
}
