import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { ERROR_CODE } from '@cip/shared';
import {
  type GatewayLanguageModel,
  MastraModelGateway,
  type ProviderConfig,
} from '@mastra/core/llm';
import { assertOutboundUrl } from '../../../../platform/http';
import {
  ModelRateLimitedError,
  type ModelRateLimiter,
  type ProviderRateLimitConfig,
} from './model-rate-limiter.service';
import {
  type UsageSinkPayload,
  withModelGuards,
} from './usage-metering.helper';

/** 网关侧模型引用：库内主键（计量落库）+ 限流参数。 */
export interface GatewayModelEntry {
  /** 模型库内主键：计量落库的归属 id。 */
  dbId: string;
  /** 供应商库内主键：限流计数维度（跨进程口径一致）。 */
  providerDbId: string;
  /** 每分钟请求上限；null 表示该维度不启用限流。 */
  rateLimitPerMinute: number | null;
  /** 并发上限；null 表示不启用，acquire 不占槽。 */
  maxConcurrent: number | null;
}

/** 上游调用默认执行超时：供应商未显式配置 timeoutMs 时兜底，避免出站调用无限挂起。 */
const DEFAULT_GATEWAY_TIMEOUT_MS = 30_000;

/** 网关侧供应商配置：API Key 已解密（仅驻内存，永不入日志）。 */
export interface GatewayProviderConfig {
  /** 供应商库内主键：限流与审计维度。 */
  dbId: string;
  /** 路由用 slug：`cip/<slug>/<modelId>` 字符串路由的资源段。 */
  slug: string;
  /** 上游 OpenAI 兼容地址；出站前经策略校验（ADR-0038）。 */
  baseUrl: string;
  /** 解密后的 API Key；仅驻内存，禁止入日志或快照。 */
  apiKey: string;
  /** 上游调用执行超时毫秒；null 时用网关默认兜底。 */
  timeoutMs: number | null;
  /** 已注册模型名 → 库内引用；网关路由与限流参数的唯一来源。 */
  models: Map<string, GatewayModelEntry>;
}

interface GatewayDeps {
  rateLimiter: ModelRateLimiter;
  /** 计量入队：modelId 由工厂绑定，pricingId 由消费者解析（ADR-0015）。 */
  enqueueUsage: (modelDbId: string, payload: UsageSinkPayload) => void;
  logWarn: (message: string) => void;
}

/**
 * 页面配置驱动的 mastra 自定义网关（ADR-0015）：
 * - 供应商/模型/凭据全部来自 DB 快照（工厂按次构建，页面改动即时生效）；
 * - 每次真实调用经限流 + 计量守卫（withModelGuards）；
 * - fetchProviders 仅供 mastra dev 模式 registry 同步，运行时解析走本类实例。
 */
export class ConfiguredModelGateway extends MastraModelGateway {
  readonly id = 'cip';
  readonly name = 'CIP Platform Model Gateway';

  constructor(
    private readonly providers: GatewayProviderConfig[],
    private readonly deps: GatewayDeps,
  ) {
    super();
  }

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    const configs: Record<string, ProviderConfig> = {};
    for (const provider of this.providers) {
      configs[provider.slug] = {
        url: provider.baseUrl,
        name: provider.slug,
        // 网关自带 getApiKey（DB 密文），env 变量名仅为类型必填占位
        apiKeyEnvVar: 'CIP_MODEL_PROVIDER_API_KEY',
        models: [...provider.models.keys()],
        gateway: this.id,
      };
    }
    return configs;
  }

  buildUrl(modelId: string): string | undefined {
    const resolved = this.findGatewayModel(modelId);
    return resolved ? resolved.provider.baseUrl : undefined;
  }

  async getApiKey(modelId: string): Promise<string> {
    const resolved = this.findGatewayModel(modelId);
    if (!resolved) {
      throw new Error(
        `${ERROR_CODE.model.modelNotFound}: 网关内未注册模型 ${modelId}`,
      );
    }
    return resolved.provider.apiKey;
  }

  async resolveLanguageModel({
    modelId,
    providerId,
    apiKey,
  }: {
    modelId: string;
    providerId: string;
    apiKey: string;
  }): Promise<GatewayLanguageModel> {
    const provider =
      this.providers.find((candidate) => candidate.slug === providerId) ??
      this.providers.find((candidate) => candidate.models.has(modelId));
    if (!provider) {
      throw new Error(
        `${ERROR_CODE.model.providerNotFound}: 网关内未注册供应商 ${providerId}`,
      );
    }
    const entry = provider.models.get(modelId);
    if (!entry) {
      throw new Error(
        `${ERROR_CODE.model.modelNotFound}: 网关内未注册模型 ${modelId}`,
      );
    }
    assertOutboundUrl(provider.baseUrl);

    const compatible = createOpenAICompatible({
      name: `${this.id}/${provider.slug}`,
      baseURL: provider.baseUrl,
      apiKey,
      includeUsage: true,
      fetch: this.timeoutFetch(provider.timeoutMs),
    });
    const inner = compatible.chatModel(modelId);

    const limitConfig: ProviderRateLimitConfig = {
      rateLimitPerMinute: entry.rateLimitPerMinute,
      maxConcurrent: entry.maxConcurrent,
    };
    return withModelGuards(inner, {
      enqueueUsage: (payload) => this.deps.enqueueUsage(entry.dbId, payload),
      acquireSlot: () => {
        try {
          return this.deps.rateLimiter.acquire(provider.dbId, limitConfig);
        } catch (cause) {
          // acquire 内部已 fail-open；此兜底把限流拒绝原样上抛
          if (cause instanceof ModelRateLimitedError) throw cause;
          throw cause;
        }
      },
      releaseSlot: () => {
        void this.deps.rateLimiter.release(provider.dbId);
      },
    });
  }

  /** 连通性测试用：直取供应商下已注册模型名清单。 */
  modelIdsOf(slug: string): string[] {
    const provider = this.providers.find(
      (candidate) => candidate.slug === slug,
    );
    return provider ? [...provider.models.keys()] : [];
  }

  /**
   * 辅助直调（resolveModel 路径）：按注册快照解析模型实例（含守卫包装）。
   * 与路由路径共用 resolveLanguageModel，计量/限流行为完全一致。
   */
  resolveRegisteredModel(
    providerSlug: string,
    modelId: string,
  ): GatewayLanguageModel | null {
    const provider = this.providers.find(
      (candidate) => candidate.slug === providerSlug,
    );
    const entry = provider?.models.get(modelId);
    if (!provider || !entry) return null;
    assertOutboundUrl(provider.baseUrl);
    const compatible = createOpenAICompatible({
      name: `${this.id}/${provider.slug}`,
      baseURL: provider.baseUrl,
      apiKey: provider.apiKey,
      includeUsage: true,
      fetch: this.timeoutFetch(provider.timeoutMs),
    });
    return withModelGuards(compatible.chatModel(modelId), {
      enqueueUsage: (payload) => this.deps.enqueueUsage(entry.dbId, payload),
      acquireSlot: () =>
        this.deps.rateLimiter.acquire(provider.dbId, {
          rateLimitPerMinute: entry.rateLimitPerMinute,
          maxConcurrent: entry.maxConcurrent,
        }),
      releaseSlot: () => {
        void this.deps.rateLimiter.release(provider.dbId);
      },
    });
  }

  /** 支持裸模型名 / `slug/model` / `cip/slug/model` 三种形态的归属解析。 */
  private findGatewayModel(
    modelId: string,
  ): { provider: GatewayProviderConfig; entry: GatewayModelEntry } | null {
    for (const provider of this.providers) {
      const entry = provider.models.get(modelId);
      if (entry) return { provider, entry };
      for (const [candidateId, candidateEntry] of provider.models) {
        if (
          modelId.endsWith(`/${provider.slug}/${candidateId}`) ||
          modelId.endsWith(`${provider.slug}/${candidateId}`)
        ) {
          return { provider, entry: candidateEntry };
        }
      }
    }
    return null;
  }

  /** 上游调用超时经自定义 fetch 注入；未配置时 30s 默认兜底，超时与调用方 abort 合并传播。 */
  private timeoutFetch(timeoutMs: number | null): typeof globalThis.fetch {
    const effectiveMs = timeoutMs ?? DEFAULT_GATEWAY_TIMEOUT_MS;
    return (input, init) => {
      const timeout = AbortSignal.timeout(effectiveMs);
      const caller = init?.signal;
      return globalThis.fetch(input, {
        ...init,
        signal: caller ? AbortSignal.any([caller, timeout]) : timeout,
      });
    };
  }
}
