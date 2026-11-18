import type { TableQueryRequest } from '@cip/shared';
import { ERROR_CODE, type ModelCapabilities } from '@cip/shared';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DomainError } from '../domain/domain.error';
import {
  PROVIDER_REPOSITORY,
  type ProviderRepository,
} from '../domain/model-provider.repository';
import {
  MODEL_REGISTRATION_PORT,
  type ModelRegistrationPort,
} from '../domain/model-registration.port';
import { ProviderModel } from '../domain/provider-model.entity';
import {
  type ModelConfigurationField,
  type ModelView,
  PROVIDER_MODEL_REPOSITORY,
  type ProviderModelRepository,
} from '../domain/provider-model.repository';
import { CatalogService } from './catalog.service';

/** 基线缺省：models.dev 未收录 limit 时的保守占位，导入后可编辑。 */
const FALLBACK_CONTEXT_WINDOW = 8_192;
const FALLBACK_MAX_OUTPUT = 4_096;

/** 能力筛选的合法键（布尔能力位）。 */
export type CapabilityFilterKey = Exclude<
  keyof ModelCapabilities,
  'contextWindow' | 'maxOutputTokens'
>;

/** 模型注册服务（应用层）：CRUD、能力筛选与目录导入（upsert：已存在跳过不覆盖）。 */
@Injectable()
export class ProviderModelService {
  constructor(
    @Inject(PROVIDER_MODEL_REPOSITORY)
    private readonly models: ProviderModelRepository,
    @Inject(PROVIDER_REPOSITORY)
    private readonly providers: ProviderRepository,
    @Inject(MODEL_REGISTRATION_PORT)
    private readonly registration: ModelRegistrationPort,
    private readonly catalog: CatalogService,
  ) {}

  /**
   * 模型表格查询（POST /ai/models/query 用例）：scope.providerId 经供应商存在性校验后
   * 组合为强制 where（客户端不可绕过）；无 scope 查询跨供应商总览。
   */
  async queryTable(query: TableQueryRequest): Promise<{
    items: ModelView[];
    total: number;
  }> {
    const providerId = query.scope?.providerId;
    if (typeof providerId === 'string') {
      await this.ensureProvider(providerId);
    }
    return this.models.queryTable(
      query,
      typeof providerId === 'string' ? { providerId } : undefined,
    );
  }

  async listByProvider(providerId: string): Promise<ModelView[]> {
    await this.ensureProvider(providerId);
    return this.models.listByProvider(providerId);
  }

  async listAll(providerId?: string): Promise<ModelView[]> {
    return this.models.listAll({ providerId });
  }

  /** 按能力筛模型：仅返回启用中的模型（请求前置校验与模型选择的查询依据）。 */
  async listWithCapability(
    capability: CapabilityFilterKey,
    providerId?: string,
  ): Promise<ModelView[]> {
    return this.models.listAll({ capability, providerId });
  }

  async getDetail(id: string): Promise<ModelView> {
    const view = await this.models.findViewById(id);
    if (!view) {
      throw this.notFoundError();
    }
    return view;
  }

  async create(
    providerId: string,
    input: {
      modelId: string;
      logicalKey: string;
      displayName: string;
      capabilities: ModelCapabilities;
      defaultParams: Record<string, unknown> | null;
    },
  ): Promise<ModelView> {
    await this.ensureProvider(providerId);
    if (await this.models.existsByLogicalKey(input.logicalKey)) {
      throw new ConflictException({
        code: ERROR_CODE.model.logicalKeyConflict,
        message: `调用名 ${input.logicalKey} 已存在`,
      });
    }
    if (await this.models.existsByProviderModel(providerId, input.modelId)) {
      throw new ConflictException({
        code: ERROR_CODE.model.modelConflict,
        message: `该供应商已注册模型 ${input.modelId}`,
      });
    }
    const model = ProviderModel.register({
      providerId,
      modelId: input.modelId,
      logicalKey: input.logicalKey,
      displayName: input.displayName,
      capabilities: input.capabilities,
      defaultParams: input.defaultParams,
    });
    try {
      return await this.models.create(model);
    } catch (cause) {
      throw this.toHttpException(cause);
    }
  }

  async update(
    id: string,
    input: {
      displayName?: string;
      capabilities?: ModelCapabilities;
      defaultParams?: Record<string, unknown> | null;
    },
  ): Promise<ModelView> {
    const model = await this.mustFindById(id);
    model.reconfigure({
      displayName: input.displayName ?? model.displayName,
      capabilities: input.capabilities ?? model.capabilities,
      defaultParams:
        input.defaultParams === undefined
          ? model.defaultParams
          : input.defaultParams,
    });
    const fields: ModelConfigurationField[] = [];
    if (input.displayName !== undefined) fields.push('displayName');
    if (input.capabilities !== undefined) fields.push('capabilities');
    if (input.defaultParams !== undefined) fields.push('defaultParams');
    if (fields.length > 0) await this.models.saveConfiguration(model, fields);
    return this.getDetail(id);
  }

  /** 启停模型：字段型状态独立子资源。 */
  async setEnabled(id: string, enabled: boolean): Promise<ModelView> {
    const model = await this.mustFindById(id);
    if (enabled) model.enable();
    else model.disable();
    await this.models.saveEnabled(model);
    return this.getDetail(id);
  }

  /** 有计量/价格版本引用时外键 Restrict 拒绝（翻译为 409 in_use），停用为唯一下线手段。 */
  async remove(id: string): Promise<void> {
    await this.mustFindById(id);
    try {
      await this.models.remove(id);
    } catch (cause) {
      throw this.toHttpException(cause);
    }
  }

  /**
   * 目录导入（upsert 语义，对应约定）：已存在的 (providerId, modelId) 跳过不覆盖；
   * 新模型按基线预填能力与价格版本（价格仅当 input/output 均在册时创建）。
   */
  async createImport(
    providerId: string,
    input: { catalogProviderId: string; modelIds: string[] },
  ) {
    await this.ensureProvider(providerId);
    const catalog = await this.catalog.get(input.catalogProviderId);
    const entries = new Map(
      catalog.models.map((entry) => [entry.modelId, entry]),
    );
    const items: Array<{
      modelId: string;
      status: 'created' | 'skipped' | 'failed';
      error: string | null;
    }> = [];
    const now = new Date();
    for (const modelId of new Set(input.modelIds)) {
      const entry = entries.get(modelId);
      if (!entry) {
        items.push({ modelId, status: 'failed', error: '目录中不存在该模型' });
        continue;
      }
      try {
        if (await this.models.existsByProviderModel(providerId, modelId)) {
          items.push({ modelId, status: 'skipped', error: null });
          continue;
        }
        const model = ProviderModel.register({
          providerId,
          modelId,
          logicalKey: await this.availableLogicalKey(providerId, modelId),
          displayName: entry.displayName || modelId,
          capabilities: {
            contextWindow: entry.contextWindow ?? FALLBACK_CONTEXT_WINDOW,
            maxOutputTokens: entry.maxOutputTokens ?? FALLBACK_MAX_OUTPUT,
            toolCall: entry.toolCall,
            imageInput: entry.imageInput,
            audioInput: false,
            structuredOutput: entry.structuredOutput,
            reasoning: entry.reasoning,
            embedding: false,
            streaming: true,
          },
          defaultParams: null,
        });
        items.push({
          modelId,
          status: await this.registration.create(model, entry, now),
          error: null,
        });
      } catch (cause) {
        items.push({
          modelId,
          status: 'failed',
          error:
            cause instanceof DomainError
              ? cause.message
              : '模型注册失败，请重试',
        });
      }
    }
    return {
      created: items.filter((i) => i.status === 'created').length,
      skipped: items.filter((i) => i.status === 'skipped').length,
      failed: items.filter((i) => i.status === 'failed').length,
      items,
    };
  }

  /** logicalKey 冲突时回退为 `${providerSlug}-${modelId}` 形态，仍冲突则报 409。 */
  private async availableLogicalKey(
    providerId: string,
    modelId: string,
  ): Promise<string> {
    const provider = await this.providers.findById(providerId);
    const primary = sanitizeLogicalKey(modelId);
    if (!(await this.models.existsByLogicalKey(primary))) return primary;
    const fallback = sanitizeLogicalKey(
      `${provider?.slug ?? 'provider'}-${modelId}`,
    );
    if (!(await this.models.existsByLogicalKey(fallback))) return fallback;
    throw new ConflictException({
      code: ERROR_CODE.model.logicalKeyConflict,
      message: `调用名 ${primary} 冲突，请手动指定`,
    });
  }

  private async mustFindById(id: string): Promise<ProviderModel> {
    const model = await this.models.findById(id);
    if (!model) {
      throw this.notFoundError();
    }
    return model;
  }

  private async ensureProvider(providerId: string): Promise<void> {
    const provider = await this.providers.findById(providerId);
    if (!provider) {
      throw new NotFoundException({
        code: ERROR_CODE.model.providerNotFound,
        message: '供应商不存在',
      });
    }
  }

  private notFoundError(): NotFoundException {
    return new NotFoundException({
      code: ERROR_CODE.model.modelNotFound,
      message: '模型不存在',
    });
  }

  private toHttpException(cause: unknown): unknown {
    if (cause instanceof DomainError)
      return new ConflictException({
        code: cause.code,
        message: cause.message,
      });
    return cause;
  }
}

/** kebab-case 化：小写、非法字符转中划线、去重压缩、去首尾中划线。 */
function sanitizeLogicalKey(modelId: string): string {
  const slug = modelId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === '' ? 'model' : slug.slice(0, 64);
}
