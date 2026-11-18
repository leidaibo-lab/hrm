import { Inject, Injectable } from '@nestjs/common';
import { HttpService } from '../../../platform/http';
import type {
  CatalogModel,
  CatalogPort,
  CatalogProvider,
} from '../domain/catalog.port';

const MODELS_DEV_API = 'https://models.dev/api.json';
const CATALOG_TIMEOUT_MS = 10_000;

/** models.dev api.json 的原始条目形态（仅取消费字段，其余忽略）。 */
interface ModelsDevProviderRaw {
  name?: string;
  models?: Record<
    string,
    {
      id?: string;
      name?: string;
      reasoning?: boolean;
      tool_call?: boolean;
      structured_output?: boolean;
      attachment?: boolean;
      cost?: {
        input?: number;
        output?: number;
        cache_read?: number;
        cache_write?: number;
        reasoning?: number;
      };
      limit?: { context?: number; output?: number };
    }
  >;
}

/**
 * models.dev 目录客户端（ADR-0084）：仅后台同步任务访问外网。
 * 价格单位 USD / 每百万 token；调用链路不依赖本服务。
 */
@Injectable()
export class ModelsDevService implements CatalogPort {
  constructor(
    @Inject(HttpService)
    private readonly http: HttpService,
  ) {}

  async fetchCatalog(): Promise<CatalogProvider[]> {
    const raw = await this.http.getJson<Record<string, ModelsDevProviderRaw>>(
      MODELS_DEV_API,
      { timeoutMs: CATALOG_TIMEOUT_MS },
    );
    return Object.entries(raw ?? {})
      .map(([providerId, provider]) =>
        this.toProviderView(providerId, provider),
      )
      .filter((provider) => provider.models.length > 0)
      .sort((left, right) => left.providerId.localeCompare(right.providerId));
  }

  private toProviderView(
    providerId: string,
    provider: ModelsDevProviderRaw,
  ): CatalogProvider {
    const models = Object.entries(provider.models ?? {})
      .filter(([modelId, model]) => model.id !== undefined || modelId !== '')
      .map(([modelId, model]) => this.toModelView(modelId, model));
    return {
      providerId,
      name: provider.name ?? providerId,
      models,
    };
  }

  private toModelView(
    modelId: string,
    model: NonNullable<ModelsDevProviderRaw['models']>[string],
  ): CatalogModel {
    return {
      modelId: model.id ?? modelId,
      displayName: model.name ?? modelId,
      reasoning: model.reasoning === true,
      toolCall: model.tool_call === true,
      structuredOutput: model.structured_output === true,
      imageInput: model.attachment === true,
      contextWindow: positiveOrNull(model.limit?.context),
      maxOutputTokens: positiveOrNull(model.limit?.output),
      input: nonNegativeOrNull(model.cost?.input),
      output: nonNegativeOrNull(model.cost?.output),
      cacheRead: nonNegativeOrNull(model.cost?.cache_read),
      cacheWrite: nonNegativeOrNull(model.cost?.cache_write),
      reasoningPrice: nonNegativeOrNull(model.cost?.reasoning),
    };
  }
}

function positiveOrNull(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : null;
}

function nonNegativeOrNull(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;
}
