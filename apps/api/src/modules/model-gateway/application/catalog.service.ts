import { ERROR_CODE } from '@cip/shared';
import {
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  CATALOG_PORT,
  type CatalogPort,
  type CatalogProvider,
} from '../domain/catalog.port';
import {
  CATALOG_SYNC_REPOSITORY,
  type CatalogSyncRecord,
  type CatalogSyncRepository,
} from '../domain/catalog.repository';
import {
  MODEL_REPOSITORY,
  type ModelRepository,
} from '../domain/model.repository';
import {
  PRICE_REPOSITORY,
  type PriceRepository,
} from '../domain/price.repository';
import { SNAPSHOT_PORT, type SnapshotPort } from '../domain/runtime.port';

/** 同步结果：记录本身 + 本次写入/未匹配计数（与 CatalogSyncRecord 同源）。 */
export type CatalogSyncView = CatalogSyncRecord;

/** 目录应用服务：models.dev 预览与后台同步；同步失败保留旧价格并记录 failed。 */
@Injectable()
export class CatalogService {
  constructor(
    @Inject(CATALOG_PORT)
    private readonly catalog: CatalogPort,
    @Inject(CATALOG_SYNC_REPOSITORY)
    private readonly syncs: CatalogSyncRepository,
    @Inject(MODEL_REPOSITORY)
    private readonly models: ModelRepository,
    @Inject(PRICE_REPOSITORY)
    private readonly prices: PriceRepository,
    @Inject(SNAPSHOT_PORT)
    private readonly snapshot: SnapshotPort & { invalidate(): void },
  ) {}

  async list(): Promise<CatalogProvider[]> {
    return this.catalog.fetchCatalog().catch((cause: unknown) => {
      throw new ServiceUnavailableException({
        code: ERROR_CODE.model.catalogUnavailable,
        message:
          '模型目录拉取失败（可手动录入）: ' +
          (cause instanceof Error ? cause.message : String(cause)),
      });
    });
  }

  async get(providerId: string): Promise<CatalogProvider> {
    const provider = (await this.list()).find(
      (row) => row.providerId === providerId,
    );
    if (!provider) {
      throw new NotFoundException({
        code: ERROR_CODE.model.catalogProviderNotFound,
        message: '目录中不存在该服务商',
      });
    }
    return provider;
  }

  async listSyncs(limit = 50): Promise<CatalogSyncView[]> {
    return this.syncs.list(limit);
  }

  /** 同步目录价：写 source=models_dev、追加同步记录、统计未匹配数；失败保留旧数据。 */
  async sync(): Promise<CatalogSyncView> {
    const startedAt = new Date();
    let providers: CatalogProvider[];
    try {
      providers = await this.catalog.fetchCatalog();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      await this.syncs.create({
        startedAt,
        finishedAt: new Date(),
        status: 'failed',
        providers: 0,
        models: 0,
        pricesWritten: 0,
        unmatched: 0,
        error: message,
      });
      throw new ServiceUnavailableException({
        code: ERROR_CODE.model.catalogUnavailable,
        message: `模型目录同步失败，已保留旧价格: ${message}`,
      });
    }

    const candidates = await this.models.listCandidatesWithProvider();
    let pricesWritten = 0;
    let unmatched = 0;
    for (const candidate of candidates) {
      const catalogProviderId = candidate.providerCatalogProviderId;
      const catalogModelId =
        candidate.catalogModelId ?? candidate.providerModelId;
      const provider = catalogProviderId
        ? providers.find((row) => row.providerId === catalogProviderId)
        : undefined;
      const model = provider?.models.find(
        (row) => row.modelId === catalogModelId,
      );
      if (!model || (model.input === null && model.output === null)) {
        unmatched += 1;
        continue;
      }
      const written = await this.prices.recordCatalog({
        candidateId: candidate.id,
        currency: 'USD',
        input: amount(model.input),
        output: amount(model.output),
        cacheRead: model.cacheRead === null ? null : amount(model.cacheRead),
        cacheWrite: model.cacheWrite === null ? null : amount(model.cacheWrite),
        reasoning:
          model.reasoningPrice === null ? null : amount(model.reasoningPrice),
        fetchedAt: new Date(),
      });
      if (written) pricesWritten += 1;
    }

    const models = providers.reduce(
      (total, provider) => total + provider.models.length,
      0,
    );
    const record = await this.syncs.create({
      startedAt,
      finishedAt: new Date(),
      status: unmatched > 0 ? 'partial' : 'success',
      providers: providers.length,
      models,
      pricesWritten,
      unmatched,
      error: null,
    });
    this.snapshot.invalidate();
    return record;
  }
}

function amount(value: number | null): string {
  return value === null ? '0' : String(value);
}
