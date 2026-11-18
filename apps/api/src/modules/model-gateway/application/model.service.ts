import {
  type DefaultModelParams,
  ERROR_CODE,
  type ModelCapabilities,
} from '@cip/shared';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type CandidateRecord,
  type CandidateUpdateData,
  type LogicalModelRecord,
  MODEL_REPOSITORY,
  type ModelRepository,
} from '../domain/model.repository';
import { PersistenceError } from '../domain/persistence.error';
import {
  PROVIDER_REPOSITORY,
  type ProviderRepository,
} from '../domain/provider.repository';
import { SNAPSHOT_PORT, type SnapshotPort } from '../domain/runtime.port';

/** 逻辑模型读模型。 */
export interface LogicalModelView {
  /** 记录标识。 */
  id: string;
  /** 逻辑模型调用名。 */
  logicalKey: string;
  /** 展示名称。 */
  displayName: string;
  /** 是否启用。 */
  enabled: boolean;
  /** 最大尝试次数。 */
  maxAttempts: number;
  /** 创建时间。 */
  createdAt: string;
}

/** 候选读模型：能力与默认参数原样返回。 */
export interface CandidateView {
  /** 记录标识。 */
  id: string;
  /** 逻辑模型标识。 */
  logicalModelId: string;
  /** 供应商标识。 */
  providerId: string;
  /** 供应商模型标识。 */
  providerModelId: string;
  /** 目录模型标识。 */
  catalogModelId: string | null;
  /** 优先级。 */
  priority: number;
  /** 是否启用。 */
  enabled: boolean;
  /** 超时时间，单位为毫秒。 */
  timeoutMs: number | null;
  /** 模型能力。 */
  capabilities: ModelCapabilities;
  /** 默认参数。 */
  defaultParams: DefaultModelParams | null;
  /** 创建时间。 */
  createdAt: string;
}

/** 逻辑模型与候选应用服务：解析锚点、候选优先级与能力事实维护。 */
@Injectable()
export class ModelService {
  constructor(
    @Inject(MODEL_REPOSITORY)
    private readonly models: ModelRepository,
    @Inject(PROVIDER_REPOSITORY)
    private readonly providers: ProviderRepository,
    @Inject(SNAPSHOT_PORT)
    private readonly snapshot: SnapshotPort & { invalidate(): void },
  ) {}

  async listLogical(): Promise<LogicalModelView[]> {
    const rows = await this.models.listLogical();
    return rows.map(toLogicalView);
  }

  async getLogical(id: string): Promise<LogicalModelView> {
    return toLogicalView(await this.mustFindLogical(id));
  }

  async createLogical(input: {
    logicalKey: string;
    displayName: string;
    maxAttempts?: number;
  }): Promise<LogicalModelView> {
    const record = await this.models
      .createLogical({
        logicalKey: input.logicalKey,
        displayName: input.displayName,
        maxAttempts: input.maxAttempts ?? 3,
      })
      .catch((cause: unknown) => this.rethrow(cause));
    this.snapshot.invalidate();
    return toLogicalView(record);
  }

  async updateLogical(
    id: string,
    input: { displayName?: string; maxAttempts?: number },
  ): Promise<LogicalModelView> {
    await this.mustFindLogical(id);
    const record = await this.models.updateLogical(id, input);
    this.snapshot.invalidate();
    return toLogicalView(record);
  }

  async setLogicalEnabled(
    id: string,
    enabled: boolean,
  ): Promise<LogicalModelView> {
    await this.mustFindLogical(id);
    const record = await this.models.setLogicalEnabled(id, enabled);
    this.snapshot.invalidate();
    return toLogicalView(record);
  }

  async listCandidates(logicalModelId: string): Promise<CandidateView[]> {
    await this.mustFindLogical(logicalModelId);
    const rows = await this.models.listCandidates(logicalModelId);
    return rows.map(toCandidateView);
  }

  async createCandidate(
    logicalModelId: string,
    input: {
      providerId: string;
      providerModelId: string;
      catalogModelId?: string | null;
      priority: number;
      timeoutMs?: number | null;
      capabilities: ModelCapabilities;
      defaultParams?: DefaultModelParams | null;
    },
  ): Promise<CandidateView> {
    await this.mustFindLogical(logicalModelId);
    const provider = await this.providers.findById(input.providerId);
    if (!provider) {
      throw new NotFoundException({
        code: ERROR_CODE.model.providerNotFound,
        message: '供应商不存在',
      });
    }
    const record = await this.models
      .createCandidate({
        logicalModelId,
        providerId: input.providerId,
        providerModelId: input.providerModelId,
        catalogModelId: input.catalogModelId ?? null,
        priority: input.priority,
        timeoutMs: input.timeoutMs ?? null,
        capabilities: input.capabilities,
        defaultParams: input.defaultParams ?? null,
      })
      .catch((cause: unknown) => this.rethrow(cause));
    this.snapshot.invalidate();
    return toCandidateView(record);
  }

  async updateCandidate(
    id: string,
    input: CandidateUpdateData,
  ): Promise<CandidateView> {
    await this.mustFindCandidate(id);
    const record = await this.models
      .updateCandidate(id, input)
      .catch((cause: unknown) => this.rethrow(cause));
    this.snapshot.invalidate();
    return toCandidateView(record);
  }

  async setCandidateEnabled(
    id: string,
    enabled: boolean,
  ): Promise<CandidateView> {
    await this.mustFindCandidate(id);
    const record = await this.models.setCandidateEnabled(id, enabled);
    this.snapshot.invalidate();
    return toCandidateView(record);
  }

  private async mustFindLogical(id: string): Promise<LogicalModelRecord> {
    const logical = await this.models.findLogical(id);
    if (!logical) {
      throw new NotFoundException({
        code: ERROR_CODE.model.logicalModelNotFound,
        message: '逻辑模型不存在',
      });
    }
    return logical;
  }

  private async mustFindCandidate(id: string) {
    const candidate = await this.models.findCandidate(id);
    if (!candidate) {
      throw new NotFoundException({
        code: ERROR_CODE.model.candidateNotFound,
        message: '候选不存在',
      });
    }
    return candidate;
  }

  private rethrow(cause: unknown): never {
    if (cause instanceof PersistenceError) {
      throw new ConflictException({ code: cause.code, message: cause.message });
    }
    throw cause;
  }
}

function toLogicalView(row: LogicalModelRecord): LogicalModelView {
  return {
    id: row.id,
    logicalKey: row.logicalKey,
    displayName: row.displayName,
    enabled: row.enabled,
    maxAttempts: row.maxAttempts,
    createdAt: row.createdAt.toISOString(),
  };
}

function toCandidateView(row: CandidateRecord): CandidateView {
  return {
    id: row.id,
    logicalModelId: row.logicalModelId,
    providerId: row.providerId,
    providerModelId: row.providerModelId,
    catalogModelId: row.catalogModelId,
    priority: row.priority,
    enabled: row.enabled,
    timeoutMs: row.timeoutMs,
    capabilities: row.capabilities,
    defaultParams: row.defaultParams,
    createdAt: row.createdAt.toISOString(),
  };
}
