import type { CandidateEntry } from './candidate.entity';
import type { LogicalModelEntity } from './logical-model.entity';
import type { ProviderEntity } from './provider.entity';

/** 快照端口注入令牌：application 依赖，infrastructure 实现。 */
export const SNAPSHOT_PORT = Symbol('SNAPSHOT_PORT');

/** 熔断端口注入令牌。 */
export const BREAKER_PORT = Symbol('BREAKER_PORT');

/** 限流端口注入令牌。 */
export const RATE_LIMIT_PORT = Symbol('RATE_LIMIT_PORT');

/** mastra 网关适配器注入令牌：application 依赖，infrastructure 实现。 */
export const GATEWAY_RUNTIME_PORT = Symbol('GATEWAY_RUNTIME_PORT');

/** 路由快照：供应商、逻辑模型与候选链的内存视图。 */
export interface RoutingSnapshot {
  /** 供应商库内主键 → 路由视图（含密文配置）。 */
  providers: Map<string, ProviderEntity>;
  /** 逻辑模型 key → 逻辑模型视图。 */
  logicalByKey: Map<string, LogicalModelEntity>;
  /** 逻辑模型主键 → 候选链（未过滤）。 */
  candidatesByLogical: Map<string, CandidateEntry[]>;
}

/** 快照端口：application 依赖，infrastructure 实现。 */
export interface SnapshotPort {
  /** 读取当前快照；实现负责 TTL 与故障回退。 */
  get(): Promise<RoutingSnapshot>;
}

/** 熔断端口：application 依赖，infrastructure 实现。 */
export interface BreakerPort {
  /** 判断供应商当前是否允许参与路由。 */
  allows(providerId: string, at: number): boolean;
}

/** 熔断记录端口：运行时包装在调用结束后写成功/失败。 */
export interface BreakerRecorderPort extends BreakerPort {
  /** 记录一次成功并复位熔断状态。 */
  recordSuccess(providerId: string): void;
  /** 记录一次失败；可重试错误才累计。 */
  recordFailure(
    providerId: string,
    options: { retryable: boolean; retryAfterMs?: number; at: number },
  ): void;
}

/** 限流端口：按供应商每分钟固定窗口计数；Redis 故障 fail-open。 */
export interface RateLimitPort {
  /**
   * 消耗一次调用额度；超限抛 ModelCallError('model.rate_limited')。
   * @param providerId - 供应商库内主键。
   * @param limitPerMinute - 每分钟上限；null 表示不启用。
   */
  acquire(providerId: string, limitPerMinute: number | null): Promise<void>;
}

/**
 * mastra 网关适配器端口：领域层不依赖第三方 SDK，
 * 具体网关与模型类型由 application 以类型参数绑定。
 */
export interface GatewayRuntimePort<TGateway, TModel> {
  /** 按当前快照构建 mastra 网关实例。 */
  createGateway(): Promise<TGateway>;
  /** 按候选解析单模型实例（直调路径，无 fallback）。 */
  resolveModel(candidate: CandidateEntry): Promise<TModel | null>;
}
