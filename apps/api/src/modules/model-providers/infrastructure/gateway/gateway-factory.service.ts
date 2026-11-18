import type {
  GatewayLanguageModel,
  MastraModelGateway,
} from '@mastra/core/llm';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { CryptoService } from '../../../../platform/crypto';
import { QueueService } from '../../../../platform/queue';
import type { ModelGatewayPort } from '../../domain/model-gateway.port';
import {
  PROVIDER_REPOSITORY,
  type ProviderRepository,
} from '../../domain/model-provider.repository';
import {
  PROVIDER_MODEL_REPOSITORY,
  type ProviderModelRepository,
} from '../../domain/provider-model.repository';
import {
  ConfiguredModelGateway,
  type GatewayProviderConfig,
} from './configured-model-gateway.service';
import { ModelRateLimiter } from './model-rate-limiter.service';

const MODEL_USAGE_QUEUE = 'model-usage';
const MODEL_USAGE_JOB = 'record';

/**
 * 网关工厂：现读 DB（供应商聚合含密文 + 模型注册）→ 解密凭据 → 构建 ConfiguredModelGateway。
 * 每次构建都是新鲜快照，页面改动即时生效、零重启零缓存失效（ADR-0015）。
 */
@Injectable()
export class GatewayFactory
  implements ModelGatewayPort<MastraModelGateway, GatewayLanguageModel>
{
  private readonly logger = new Logger(GatewayFactory.name);

  constructor(
    @Inject(PROVIDER_REPOSITORY)
    private readonly providers: ProviderRepository,
    @Inject(PROVIDER_MODEL_REPOSITORY)
    private readonly models: ProviderModelRepository,
    @Inject(CryptoService)
    private readonly crypto: CryptoService,
    @Inject(ModelRateLimiter)
    private readonly rateLimiter: ModelRateLimiter,
    @Inject(QueueService)
    private readonly queue: QueueService,
  ) {}

  async createGateway(): Promise<ConfiguredModelGateway> {
    const [providerRows, modelRows] = await Promise.all([
      this.providers.listAggregates(),
      this.models.listAll(),
    ]);
    const modelsByProvider = new Map<string, GatewayProviderConfig['models']>();
    for (const model of modelRows) {
      if (!model.enabled) continue;
      const modelEntries = modelsByProvider.get(model.providerId) ?? new Map();
      const providerRow = providerRows.find(
        (row) => row.id === model.providerId,
      );
      modelEntries.set(model.modelId, {
        dbId: model.id,
        providerDbId: model.providerId,
        rateLimitPerMinute: providerRow?.rateLimitPerMinute ?? null,
        maxConcurrent: providerRow?.maxConcurrent ?? null,
      });
      modelsByProvider.set(model.providerId, modelEntries);
    }

    const configs: GatewayProviderConfig[] = providerRows
      .filter((row) => row.isEnabled)
      .map((row) => ({
        dbId: row.id,
        slug: row.slug,
        baseUrl: row.baseUrl,
        apiKey: this.decryptQuietly(row.slug, row.apiKeyCipher),
        timeoutMs: row.timeoutMs,
        models: modelsByProvider.get(row.id) ?? new Map(),
      }));
    return new ConfiguredModelGateway(configs, {
      rateLimiter: this.rateLimiter,
      enqueueUsage: (modelDbId, payload) => {
        void this.queue
          .enqueue(MODEL_USAGE_QUEUE, MODEL_USAGE_JOB, {
            modelId: modelDbId,
            ...payload,
          })
          .catch((cause: unknown) => {
            this.logger.warn(
              `计量入队失败（不影响推理）: ${cause instanceof Error ? cause.message : String(cause)}`,
            );
          });
      },
      logWarn: (message) => this.logger.warn(message),
    });
  }

  /** 端口实现：构建快照后解析可调用模型（每次调用现读 DB，与网关路由路径同源）。 */
  async resolveRegisteredModel(
    providerSlug: string,
    modelId: string,
  ): Promise<GatewayLanguageModel | null> {
    const gateway = await this.createGateway();
    return gateway.resolveRegisteredModel(providerSlug, modelId);
  }

  /** 解密失败不阻断构建（如主密钥轮换后旧密文）：空 key 进入网关，调用时报错可定位。 */
  private decryptQuietly(slug: string, apiKeyCipher: string): string {
    try {
      return this.crypto.decrypt(apiKeyCipher);
    } catch (cause) {
      this.logger.warn(
        `供应商 ${slug} 凭据解密失败（主密钥不匹配？）: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
      return '';
    }
  }
}
