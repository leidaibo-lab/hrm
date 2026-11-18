import { ModelCallError } from './model-call.error';

/** 供应商健康状态：与 enabled 正交。 */
export type ProviderHealth = 'healthy' | 'degraded';

/** 供应商运行时配置：凭据只存密文，解密发生在调用瞬间。 */
export interface ProviderRuntimeConfig {
  /** 上游协议；当前仅 OpenAI 兼容。 */
  protocol: 'openai_compatible';
  /** 上游基础地址。 */
  baseUrl: string;
  /** 凭据密文；仅调用瞬间解密。 */
  apiKeyCipher: string;
  /** models.dev 供应商 key；用于目录价匹配。 */
  catalogProviderId: string | null;
  /** 单次调用超时（毫秒）。 */
  timeoutMs: number | null;
  /** 每分钟请求上限；null 表示不启用。 */
  rateLimitPerMinute: number | null;
  /** 并发上限；null 表示不启用。 */
  maxConcurrent: number | null;
}

/**
 * 供应商路由视图：包含路由状态与调用所需配置，不携带明文凭据。
 */
export class ProviderEntity {
  constructor(
    readonly id: string,
    readonly slug: string,
    readonly enabled: boolean,
    readonly health: ProviderHealth,
    readonly openUntil: Date | null,
    readonly config: ProviderRuntimeConfig | null = null,
  ) {}

  /** 是否允许参与路由：启用、非降级、熔断未打开。 */
  isRoutable(at: Date): boolean {
    if (!this.enabled || this.health !== 'healthy') return false;
    return this.openUntil === null || this.openUntil.getTime() <= at.getTime();
  }

  /** 路由前断言；失败给出明确错误码。 */
  assertRoutable(at: Date): void {
    if (!this.enabled) {
      throw new ModelCallError(
        'model.provider_model_disabled',
        '供应商已停用',
        false,
      );
    }
    if (this.health !== 'healthy') {
      throw new ModelCallError(
        'model.provider_unavailable',
        '供应商处于降级状态',
        true,
      );
    }
    if (this.openUntil !== null && this.openUntil.getTime() > at.getTime()) {
      throw new ModelCallError('model.rate_limited', '供应商熔断中', false);
    }
  }
}
