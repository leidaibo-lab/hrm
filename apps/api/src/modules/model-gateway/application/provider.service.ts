import { ERROR_CODE } from '@cip/shared';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CryptoService } from '../../../platform/crypto';
import { HttpService } from '../../../platform/http';
import { PersistenceError } from '../domain/persistence.error';
import {
  PROVIDER_REPOSITORY,
  type ProviderRecord,
  type ProviderRepository,
} from '../domain/provider.repository';
import { SNAPSHOT_PORT, type SnapshotPort } from '../domain/runtime.port';

/** 供应商读模型：凭据只暴露是否已配置。 */
export interface ProviderView {
  /** 记录标识。 */
  id: string;
  /** 名称。 */
  name: string;
  /** 短标识。 */
  slug: string;
  /** 接入协议。 */
  protocol: string;
  /** 服务地址。 */
  baseUrl: string;
  /** 目录供应商标识。 */
  catalogProviderId: string | null;
  /** 超时时间，单位为毫秒。 */
  timeoutMs: number | null;
  /** 每分钟请求数限制。 */
  rateLimitPerMinute: number | null;
  /** 最大并发数。 */
  maxConcurrent: number | null;
  /** 是否启用。 */
  enabled: boolean;
  /** 健康状态。 */
  health: string;
  /** 熔断截止时间。 */
  openUntil: string | null;
  /** 连续失败次数。 */
  consecutiveFailures: number;
  /** 是否已配置凭据。 */
  credentialConfigured: boolean;
  /** 创建时间。 */
  createdAt: string;
}

/** 连通性测试结果：结构化返回，不把上游错误抛给页面。 */
export interface ProviderConnectionView {
  /** 操作是否成功。 */
  ok: boolean;
  /** 耗时，单位为毫秒。 */
  latencyMs?: number;
  /** 模型数量。 */
  modelCount?: number;
  /** 错误信息。 */
  error?: string;
}

/** 供应商应用服务：配置维护、启停、凭据加密与连通性测试。 */
@Injectable()
export class ProviderService {
  constructor(
    @Inject(PROVIDER_REPOSITORY)
    private readonly providers: ProviderRepository,
    @Inject(SNAPSHOT_PORT)
    private readonly snapshot: SnapshotPort & { invalidate(): void },
    @Inject(CryptoService)
    private readonly crypto: CryptoService,
    @Inject(HttpService)
    private readonly http: HttpService,
  ) {}

  async list(): Promise<ProviderView[]> {
    const rows = await this.providers.list();
    return rows.map(toView);
  }

  async get(id: string): Promise<ProviderView> {
    return toView(await this.mustFind(id));
  }

  async create(input: {
    name: string;
    slug: string;
    baseUrl: string;
    apiKey: string;
    catalogProviderId?: string | null;
    timeoutMs?: number | null;
    rateLimitPerMinute?: number | null;
    maxConcurrent?: number | null;
  }): Promise<ProviderView> {
    if (await this.providers.existsBySlug(input.slug)) {
      throw new ConflictException({
        code: ERROR_CODE.model.slugConflict,
        message: '供应商 slug 已存在',
      });
    }
    const record = await this.providers
      .create({
        name: input.name,
        slug: input.slug,
        baseUrl: input.baseUrl,
        apiKeyCipher: this.crypto.encrypt(input.apiKey),
        catalogProviderId: input.catalogProviderId ?? null,
        timeoutMs: input.timeoutMs ?? null,
        rateLimitPerMinute: input.rateLimitPerMinute ?? null,
        maxConcurrent: input.maxConcurrent ?? null,
      })
      .catch((cause: unknown) => this.rethrow(cause));
    this.snapshot.invalidate();
    return toView(record);
  }

  async update(
    id: string,
    input: {
      name?: string;
      baseUrl?: string;
      apiKey?: string;
      catalogProviderId?: string | null;
      timeoutMs?: number | null;
      rateLimitPerMinute?: number | null;
      maxConcurrent?: number | null;
    },
  ): Promise<ProviderView> {
    await this.mustFind(id);
    const record = await this.providers
      .update(id, {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.baseUrl === undefined ? {} : { baseUrl: input.baseUrl }),
        ...(input.apiKey === undefined
          ? {}
          : { apiKeyCipher: this.crypto.encrypt(input.apiKey) }),
        ...(input.catalogProviderId === undefined
          ? {}
          : { catalogProviderId: input.catalogProviderId }),
        ...(input.timeoutMs === undefined
          ? {}
          : { timeoutMs: input.timeoutMs }),
        ...(input.rateLimitPerMinute === undefined
          ? {}
          : { rateLimitPerMinute: input.rateLimitPerMinute }),
        ...(input.maxConcurrent === undefined
          ? {}
          : { maxConcurrent: input.maxConcurrent }),
      })
      .catch((cause: unknown) => this.rethrow(cause));
    this.snapshot.invalidate();
    return toView(record);
  }

  async setEnabled(id: string, enabled: boolean): Promise<ProviderView> {
    await this.mustFind(id);
    const record = await this.providers.setEnabled(id, enabled);
    this.snapshot.invalidate();
    return toView(record);
  }

  /** 连通性测试：真实拉一次上游模型清单；解密失败按凭据错误返回。 */
  async testConnectivity(id: string): Promise<ProviderConnectionView> {
    const provider = await this.mustFind(id);
    let apiKey: string;
    try {
      apiKey = this.crypto.decrypt(provider.apiKeyCipher);
    } catch {
      return { ok: false, error: '凭据解密失败（主密钥不匹配？）' };
    }
    const startedAt = Date.now();
    try {
      const response = await this.http.getJson<{ data?: unknown[] }>(
        `${provider.baseUrl.replace(/\/+$/, '')}/models`,
        {
          headers: { authorization: `Bearer ${apiKey}` },
          timeoutMs: 5_000,
        },
      );
      return {
        ok: true,
        latencyMs: Date.now() - startedAt,
        modelCount: Array.isArray(response?.data) ? response.data.length : 0,
      };
    } catch (cause) {
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        error: cause instanceof Error ? cause.message : String(cause),
      };
    }
  }

  private async mustFind(id: string): Promise<ProviderRecord> {
    const provider = await this.providers.findById(id);
    if (!provider) {
      throw new NotFoundException({
        code: ERROR_CODE.model.providerNotFound,
        message: '供应商不存在',
      });
    }
    return provider;
  }

  private rethrow(cause: unknown): never {
    if (cause instanceof PersistenceError) {
      throw new ConflictException({ code: cause.code, message: cause.message });
    }
    throw cause;
  }
}

function toView(row: ProviderRecord): ProviderView {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    protocol: row.protocol,
    baseUrl: row.baseUrl,
    catalogProviderId: row.catalogProviderId,
    timeoutMs: row.timeoutMs,
    rateLimitPerMinute: row.rateLimitPerMinute,
    maxConcurrent: row.maxConcurrent,
    enabled: row.enabled,
    health: row.health,
    openUntil: row.openUntil?.toISOString() ?? null,
    consecutiveFailures: row.consecutiveFailures,
    credentialConfigured: row.apiKeyCipher.length > 0,
    createdAt: row.createdAt.toISOString(),
  };
}
