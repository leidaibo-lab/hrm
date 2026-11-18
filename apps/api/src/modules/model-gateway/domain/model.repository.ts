import type { DefaultModelParams, ModelCapabilities } from '@cip/shared';
import type { ProviderHealth } from './provider.entity';

/** 逻辑模型与候选仓储注入令牌。 */
export const MODEL_REPOSITORY = Symbol('MODEL_REPOSITORY');

/** 逻辑模型记录。 */
export interface LogicalModelRecord {
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
  createdAt: Date;
}

/** 候选记录：能力事实落在候选。 */
export interface CandidateRecord {
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
  createdAt: Date;
}

/** 候选 + 供应商路由状态：快照装配与目录匹配使用。 */
export interface CandidateWithProvider extends CandidateRecord {
  /** 供应商短标识。 */
  providerSlug: string;
  /** 供应商是否启用。 */
  providerEnabled: boolean;
  /** 供应商健康状态。 */
  providerHealth: ProviderHealth;
  /** 供应商熔断截止时间。 */
  providerOpenUntil: Date | null;
  /** 供应商对应的目录标识。 */
  providerCatalogProviderId: string | null;
}

/** 逻辑模型新建输入。 */
export interface LogicalModelCreateData {
  /** 逻辑模型调用名。 */
  logicalKey: string;
  /** 展示名称。 */
  displayName: string;
  /** 最大尝试次数。 */
  maxAttempts: number;
}

/** 逻辑模型可变更字段。 */
export interface LogicalModelUpdateData {
  /** 展示名称。 */
  displayName?: string;
  /** 最大尝试次数。 */
  maxAttempts?: number;
}

/** 候选新建输入。 */
export interface CandidateCreateData {
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
  /** 超时时间，单位为毫秒。 */
  timeoutMs: number | null;
  /** 模型能力。 */
  capabilities: ModelCapabilities;
  /** 默认参数。 */
  defaultParams: DefaultModelParams | null;
}

/** 候选可变更字段。 */
export interface CandidateUpdateData {
  /** 供应商模型标识。 */
  providerModelId?: string;
  /** 目录模型标识。 */
  catalogModelId?: string | null;
  /** 优先级。 */
  priority?: number;
  /** 超时时间，单位为毫秒。 */
  timeoutMs?: number | null;
  /** 模型能力。 */
  capabilities?: ModelCapabilities;
  /** 默认参数。 */
  defaultParams?: DefaultModelParams | null;
}

/** 逻辑模型与候选仓储端口：application 依赖，infrastructure 实现。 */
export interface ModelRepository {
  /** 列出逻辑模型。 */
  listLogical(): Promise<LogicalModelRecord[]>;
  /** 按标识查询逻辑模型，不存在时返回空值。 */
  findLogical(id: string): Promise<LogicalModelRecord | null>;
  /** 按调用名查询逻辑模型，不存在时返回空值。 */
  findLogicalByKey(logicalKey: string): Promise<LogicalModelRecord | null>;
  /** 创建逻辑模型并返回记录。 */
  createLogical(data: LogicalModelCreateData): Promise<LogicalModelRecord>;
  /** 更新逻辑模型并返回记录。 */
  updateLogical(
    id: string,
    data: LogicalModelUpdateData,
  ): Promise<LogicalModelRecord>;
  /** 设置逻辑模型的启用状态。 */
  setLogicalEnabled(id: string, enabled: boolean): Promise<LogicalModelRecord>;
  /** 列出指定逻辑模型的候选项。 */
  listCandidates(logicalModelId: string): Promise<CandidateRecord[]>;
  /** 列出候选项及其供应商。 */
  listCandidatesWithProvider(): Promise<CandidateWithProvider[]>;
  /** 按标识查询候选项及其供应商，不存在时返回空值。 */
  findCandidate(id: string): Promise<CandidateWithProvider | null>;
  /** 创建候选项并返回记录。 */
  createCandidate(data: CandidateCreateData): Promise<CandidateRecord>;
  /** 更新候选项并返回记录。 */
  updateCandidate(
    id: string,
    data: CandidateUpdateData,
  ): Promise<CandidateRecord>;
  /** 设置候选项的启用状态。 */
  setCandidateEnabled(id: string, enabled: boolean): Promise<CandidateRecord>;
}
