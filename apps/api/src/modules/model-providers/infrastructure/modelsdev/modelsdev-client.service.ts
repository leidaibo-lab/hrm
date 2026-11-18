import { Inject, Injectable } from '@nestjs/common';
import { HttpService } from '../../../../platform/http';
import type {
  CatalogModelView,
  CatalogPort,
  CatalogProviderView,
} from '../../domain/catalog.port';

const MODELS_DEV_API = 'https://models.dev/api.json';
const CATALOG_TIMEOUT_MS = 10_000;

/** models.dev api.json 的原始条目形态（仅取我们消费的字段，其余忽略）。 */
interface ModelsDevProviderRaw {
  name?: string;
  doc?: string;
  env?: string[];
  models?: Record<
    string,
    {
      id?: string;
      name?: string;
      reasoning?: boolean;
      tool_call?: boolean;
      structured_output?: boolean;
      attachment?: boolean;
      status?: string;
      cost?: {
        input?: number;
        output?: number;
        cache_read?: number;
        cache_write?: number;
      };
      limit?: { context?: number; output?: number };
    }
  >;
}

/**
 * models.dev 目录客户端（ADR-0015）：导入向导的基线数据源，实现目录端口。
 * 价格单位 USD / 每百万 token；能力布尔位与 limit 字段映射为平台 capabilities 预填值。
 * 仅作填充源，计费事实源始终是平台自有 ModelPricing 表。
 */
@Injectable()
export class ModelsDevClient implements CatalogPort {
  constructor(
    @Inject(HttpService)
    private readonly http: HttpService,
  ) {}

  async fetchCatalog(): Promise<CatalogProviderView[]> {
    const raw = await this.http.getJson<Record<string, ModelsDevProviderRaw>>(
      MODELS_DEV_API,
      { timeoutMs: CATALOG_TIMEOUT_MS },
    );
    return Object.entries(raw ?? {})
      .map(([providerId, provider]) =>
        this.toProviderView(providerId, provider),
      )
      .filter((provider) => provider.models.length > 0)
      .sort((a, b) => a.providerId.localeCompare(b.providerId));
  }

  private toProviderView(
    providerId: string,
    provider: ModelsDevProviderRaw,
  ): CatalogProviderView {
    const models = Object.entries(provider.models ?? {})
      .filter(([modelId, model]) => model.id !== undefined || modelId !== '')
      .map(([modelId, model]) => this.toModelView(modelId, model));
    return {
      providerId,
      name: provider.name ?? providerId,
      // models.dev 不直接提供兼容 baseUrl；导入后由管理员按实际接入点填写
      baseUrl: null,
      models,
    };
  }

  private toModelView(
    modelId: string,
    model: NonNullable<ModelsDevProviderRaw['models']>[string],
  ): CatalogModelView {
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
