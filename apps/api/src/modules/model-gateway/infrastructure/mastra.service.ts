import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import {
  type GatewayLanguageModel,
  MastraModelGateway,
  type ProviderConfig,
} from '@mastra/core/llm';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { CryptoService } from '../../../platform/crypto';
import { assertOutboundUrl } from '../../../platform/http';
import type { CandidateEntry } from '../domain/candidate.entity';
import { ProviderEntity } from '../domain/provider.entity';
import {
  BREAKER_PORT,
  type BreakerRecorderPort,
  type GatewayRuntimePort,
  RATE_LIMIT_PORT,
  type RateLimitPort,
  type RoutingSnapshot,
  SNAPSHOT_PORT,
  type SnapshotPort,
} from '../domain/runtime.port';
import {
  USAGE_SINK_PORT,
  type UsageSinkPort,
} from '../domain/usage.repository';
import {
  type GatewayGuardDeps,
  withGatewayGuards,
} from './usage-metering.helper';

/** 上游调用默认超时：供应商未配置时兜底，避免出站调用无限挂起。 */
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * mastra 网关适配器（ADR-0084）：凭据只存密文，调用瞬间解密；
 * 模型串规则 cip/<slug>/<modelId>，每次调用经限流、熔断与计量包装。
 */
@Injectable()
export class MastraService
  implements GatewayRuntimePort<MastraModelGateway, GatewayLanguageModel>
{
  private readonly logger = new Logger(MastraService.name);

  constructor(
    @Inject(SNAPSHOT_PORT)
    private readonly snapshot: SnapshotPort,
    @Inject(CryptoService)
    private readonly crypto: CryptoService,
    @Inject(RATE_LIMIT_PORT)
    private readonly rateLimit: RateLimitPort,
    @Inject(BREAKER_PORT)
    private readonly breaker: BreakerRecorderPort,
    @Inject(USAGE_SINK_PORT)
    private readonly usage: UsageSinkPort,
  ) {}

  async createGateway(): Promise<MastraModelGateway> {
    const snapshot = await this.snapshot.get();
    return new SnapshotModelGateway(snapshot, this.crypto, this.deps());
  }

  async resolveModel(
    candidate: CandidateEntry,
  ): Promise<GatewayLanguageModel | null> {
    const snapshot = await this.snapshot.get();
    const provider = snapshot.providers.get(candidate.providerId);
    if (!provider || !isConfiguredProvider(provider)) return null;
    return buildGuardedModel(this.crypto, provider, candidate, this.deps());
  }

  private deps(): GatewayGuardDeps {
    return {
      rateLimit: this.rateLimit,
      breaker: this.breaker,
      usage: this.usage,
      logWarn: (message) => this.logger.warn(message),
    };
  }
}

/** 快照驱动的 mastra 网关：供应商与模型全部来自内存快照，不读 DB、不读 env 凭据。 */
class SnapshotModelGateway extends MastraModelGateway {
  readonly id = 'cip';
  readonly name = 'CIP Model Gateway';

  private readonly providers: ProviderGatewayConfig[];

  constructor(
    snapshot: RoutingSnapshot,
    private readonly crypto: CryptoService,
    private readonly deps: GatewayGuardDeps,
  ) {
    super();
    const candidatesByProvider = new Map<string, CandidateEntry[]>();
    for (const candidates of snapshot.candidatesByLogical.values()) {
      for (const candidate of candidates) {
        const list = candidatesByProvider.get(candidate.providerId) ?? [];
        list.push(candidate);
        candidatesByProvider.set(candidate.providerId, list);
      }
    }
    this.providers = [...snapshot.providers.values()]
      .filter(isConfiguredProvider)
      .map((provider) => ({
        provider,
        models: candidatesByProvider.get(provider.id) ?? [],
      }));
  }

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    const configs: Record<string, ProviderConfig> = {};
    for (const entry of this.providers) {
      configs[entry.provider.slug] = {
        url: entry.provider.config.baseUrl,
        name: entry.provider.slug,
        apiKeyEnvVar: 'CIP_MODEL_GATEWAY_API_KEY',
        models: uniqueModels(entry.models),
        gateway: this.id,
      };
    }
    return configs;
  }

  buildUrl(modelId: string): string | undefined {
    return this.findProvider(modelId)?.provider.config.baseUrl;
  }

  async getApiKey(modelId: string): Promise<string> {
    const entry = this.findProvider(modelId);
    if (!entry) {
      throw new Error(`model.model_not_found: 网关内未注册模型 ${modelId}`);
    }
    return decrypt(this.crypto, entry.provider);
  }

  async resolveLanguageModel({
    modelId,
    providerId,
  }: {
    modelId: string;
    providerId: string;
    apiKey: string;
  }): Promise<GatewayLanguageModel> {
    const entry =
      this.providers.find((item) => item.provider.slug === providerId) ??
      this.findProvider(modelId);
    if (!entry) {
      throw new Error(
        `model.provider_not_found: 网关内未注册供应商 ${providerId}`,
      );
    }
    const candidate = findCandidate(entry, modelId);
    if (!candidate) {
      throw new Error(`model.model_not_found: 网关内未注册模型 ${modelId}`);
    }
    return buildGuardedModel(this.crypto, entry.provider, candidate, this.deps);
  }

  private findProvider(modelId: string): ProviderGatewayConfig | undefined {
    const prefix = `${this.id}/`;
    if (modelId.startsWith(prefix)) {
      const slug = modelId.slice(prefix.length).split('/')[0];
      return this.providers.find((item) => item.provider.slug === slug);
    }
    return this.providers.find((item) => findCandidate(item, modelId));
  }
}

interface ProviderGatewayConfig {
  provider: ConfiguredProvider;
  models: CandidateEntry[];
}

type ConfiguredProvider = ProviderEntity & {
  config: NonNullable<ProviderEntity['config']>;
};

function isConfiguredProvider(
  provider: ProviderEntity,
): provider is ConfiguredProvider {
  return provider.enabled && provider.config !== null;
}

function uniqueModels(candidates: readonly CandidateEntry[]): string[] {
  const models = new Set<string>();
  for (const candidate of candidates) {
    if (candidate.enabled) models.add(candidate.providerModelId);
  }
  return [...models];
}

function findCandidate(
  entry: ProviderGatewayConfig,
  modelId: string,
): CandidateEntry | undefined {
  const last = modelId.split('/').at(-1) ?? modelId;
  return entry.models.find(
    (candidate) =>
      candidate.providerModelId === modelId ||
      candidate.providerModelId === last ||
      candidate.id === modelId ||
      candidate.id === last,
  );
}

function decrypt(crypto: CryptoService, provider: ConfiguredProvider): string {
  try {
    return crypto.decrypt(provider.config.apiKeyCipher);
  } catch {
    throw new Error(
      `model.credential_invalid: 供应商 ${provider.slug} 凭据解密失败`,
    );
  }
}

function buildGuardedModel(
  crypto: CryptoService,
  provider: ConfiguredProvider,
  candidate: CandidateEntry,
  deps: GatewayGuardDeps,
): GatewayLanguageModel {
  const inner = buildLanguageModel(crypto, provider, candidate.providerModelId);
  return withGatewayGuards(
    inner,
    {
      candidate,
      rateLimitPerMinute: provider.config.rateLimitPerMinute,
    },
    deps,
  );
}

function buildLanguageModel(
  crypto: CryptoService,
  provider: ConfiguredProvider,
  modelId: string,
): GatewayLanguageModel {
  assertOutboundUrl(provider.config.baseUrl);
  const apiKey = decrypt(crypto, provider);
  const compatible = createOpenAICompatible({
    name: `cip/${provider.slug}`,
    baseURL: provider.config.baseUrl,
    apiKey,
    includeUsage: true,
    fetch: timeoutFetch(provider.config.timeoutMs),
  });
  return compatible.chatModel(modelId) as unknown as GatewayLanguageModel;
}

function timeoutFetch(timeoutMs: number | null): typeof globalThis.fetch {
  const effectiveMs = timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return (input, init) => {
    const timeout = AbortSignal.timeout(effectiveMs);
    const caller = init?.signal;
    return globalThis.fetch(input, {
      ...init,
      signal: caller ? AbortSignal.any([caller, timeout]) : timeout,
    });
  };
}
