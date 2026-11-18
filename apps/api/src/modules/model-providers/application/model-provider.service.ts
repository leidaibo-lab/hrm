import type { TableQueryRequest } from '@cip/shared';
import { ERROR_CODE } from '@cip/shared';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CryptoService } from '../../../platform/crypto';
import { DomainError } from '../domain/domain.error';
import { ModelProvider } from '../domain/model-provider.entity';
import {
  PROVIDER_REPOSITORY,
  type ProviderConfigurationField,
  type ProviderRepository,
  type ProviderView,
} from '../domain/model-provider.repository';
import {
  PROVIDER_CONNECTION_PORT,
  type ProviderConnectionPort,
  type ProviderConnectionResult,
} from '../domain/provider-connection.port';

/** 供应商管理服务（应用层）：CRUD、凭据轮换与连通性测试。 */
@Injectable()
export class ModelProviderService {
  constructor(
    @Inject(PROVIDER_REPOSITORY)
    private readonly providers: ProviderRepository,
    @Inject(CryptoService)
    private readonly crypto: CryptoService,
    @Inject(PROVIDER_CONNECTION_PORT)
    private readonly connection: ProviderConnectionPort,
  ) {}

  /** 供应商表格查询（POST /ai/providers/query 用例）：规范请求透传仓储。 */
  async queryTable(query: TableQueryRequest): Promise<{
    items: ProviderView[];
    total: number;
  }> {
    return this.providers.queryTable(query);
  }

  async getDetail(id: string): Promise<ProviderView> {
    const view = await this.providers.findViewById(id);
    if (!view) {
      throw this.notFoundError();
    }
    return view;
  }

  async create(input: {
    slug: string;
    name: string;
    baseUrl: string;
    apiKey: string;
    timeoutMs: number | null;
    rateLimitPerMinute: number | null;
    maxConcurrent: number | null;
  }): Promise<ProviderView> {
    if (await this.providers.existsBySlug(input.slug)) {
      throw new ConflictException({
        code: ERROR_CODE.model.slugConflict,
        message: `供应商标识 ${input.slug} 已存在`,
      });
    }
    const provider = ModelProvider.register({
      slug: input.slug,
      name: input.name,
      baseUrl: input.baseUrl,
      apiKeyCipher: this.crypto.encrypt(input.apiKey),
      timeoutMs: input.timeoutMs ?? null,
      rateLimitPerMinute: input.rateLimitPerMinute ?? null,
      maxConcurrent: input.maxConcurrent ?? null,
    });
    try {
      return await this.providers.create(provider);
    } catch (cause) {
      throw this.toHttpException(cause);
    }
  }

  async update(
    id: string,
    input: {
      name: string;
      baseUrl: string;
      apiKey?: string;
      timeoutMs: number | null;
      rateLimitPerMinute: number | null;
      maxConcurrent: number | null;
    },
  ): Promise<ProviderView> {
    const provider = await this.mustFindById(id);
    provider.reconfigure({
      name: input.name,
      baseUrl: input.baseUrl,
      timeoutMs: input.timeoutMs,
      rateLimitPerMinute: input.rateLimitPerMinute,
      maxConcurrent: input.maxConcurrent,
    });
    if (input.apiKey !== undefined) {
      provider.rotateApiKey(this.crypto.encrypt(input.apiKey));
    }
    const fields: ProviderConfigurationField[] = [
      'name',
      'baseUrl',
      'timeoutMs',
      'rateLimitPerMinute',
      'maxConcurrent',
    ];
    if (input.apiKey !== undefined) fields.push('apiKeyCipher');
    await this.providers.saveConfiguration(provider, fields);
    return this.getDetail(id);
  }

  /** 启停供应商：字段型状态独立子资源。 */
  async setEnabled(id: string, enabled: boolean): Promise<ProviderView> {
    const provider = await this.mustFindById(id);
    if (enabled) provider.enable();
    else provider.disable();
    await this.providers.saveEnabled(provider);
    return this.getDetail(id);
  }

  /**
   * 删除供应商；模型仍挂载时外键 Restrict 拒绝（翻译为 409 in_use）。
   */
  async remove(id: string): Promise<void> {
    await this.mustFindById(id);
    try {
      await this.providers.remove(id);
    } catch (cause) {
      throw this.toHttpException(cause);
    }
  }

  /**
   * 连通性测试：真实请求上游 GET /models（OpenAI 兼容清单端点）。
   * 返回结构化结果而非抛错，前端直接展示成功/上游错误详情。
   */
  async testConnectivity(id: string): Promise<ProviderConnectionResult> {
    return this.connection.probe(await this.mustFindById(id));
  }

  private async mustFindById(id: string): Promise<ModelProvider> {
    const provider = await this.providers.findById(id);
    if (!provider) {
      throw this.notFoundError();
    }
    return provider;
  }

  private notFoundError(): NotFoundException {
    return new NotFoundException({
      code: ERROR_CODE.model.providerNotFound,
      message: '供应商不存在',
    });
  }

  /** 持久化冲突转换为稳定的业务响应。 */
  private toHttpException(cause: unknown): unknown {
    if (cause instanceof DomainError)
      return new ConflictException({
        code: cause.code,
        message: cause.message,
      });
    return cause;
  }
}
