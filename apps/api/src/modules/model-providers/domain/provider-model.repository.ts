import type {
  DefaultModelParams,
  ModelCapabilities,
  TableQueryRequest,
} from '@cip/shared';
import type { ProviderModel } from './provider-model.entity';

/** 注入令牌：模块内以 useClass 绑定 infrastructure 实现。 */
export const PROVIDER_MODEL_REPOSITORY = Symbol('PROVIDER_MODEL_REPOSITORY');

/** 价格视图（读模型内嵌）：金额为 Decimal 字符串，防 JSON 精度丢失。 */
export interface PricingRatesView {
  /** 本次计价引用的价格版本标识。 */
  pricingId: string;
  /** 价格使用的币种代码。 */
  currency: string;
  /** 每百万输入 token 的价格，使用定点数字符串表示。 */
  input: string;
  /** 每百万输出 token 的价格，使用定点数字符串表示。 */
  output: string;
  /** 每百万缓存读取 token 的价格；未配置时为空。 */
  cacheRead: string | null;
  /** 每百万缓存写入 token 的价格；未配置时为空。 */
  cacheWrite: string | null;
  /** 每百万推理 token 的价格；未配置时为空。 */
  reasoning: string | null;
  /** 价格开始生效的 ISO 8601 时间点。 */
  effectiveFrom: string;
}

/** 模型读模型（后台视图）：含所属供应商摘要与当前生效价。 */
export interface ModelView {
  /** 稳定标识，用于记录关联与定位。 */
  id: string;
  /** 所属服务商的主键。 */
  providerId: string;
  /** 所属服务商的稳定短名。 */
  providerSlug: string;
  /** 所属服务商的展示名称。 */
  providerName: string;
  /** 所属服务商当前是否启用。 */
  providerEnabled: boolean;
  /** 模型注册标识，用于关联模型配置与计量。 */
  modelId: string;
  /** 业务调用模型的全局唯一名称。 */
  logicalKey: string;
  /** 模型在界面中的展示名称。 */
  displayName: string;
  /** 模型支持的输入输出和调用能力。 */
  capabilities: ModelCapabilities;
  /** 调用模型时合并的默认参数；未配置时为空。 */
  defaultParams: DefaultModelParams | null;
  /** 能力是否可用，由调用方按当前上下文判定。 */
  enabled: boolean;
  /** 当前生效的价格版本；尚无生效价格时为空。 */
  currentPricing: PricingRatesView | null;
  /** 创建时间的 ISO 8601 表示。 */
  createdAt: string;
}

/** 模型注册持久化端口。 */
export interface ProviderModelRepository {
  /**
   * 查询路径：表格结构化查询（POST /ai/models/query 语义）。
   * forced 为应用层组合的强制范围（scope.providerId），不可由客户端绕过。
   */
  queryTable(
    query: TableQueryRequest,
    forced?: { providerId?: string },
  ): Promise<{ items: ModelView[]; total: number }>;
  /** 按服务商列出（后台服务商详情页）。 */
  listByProvider(providerId: string): Promise<ModelView[]>;
  /** 全量列表（跨服务商模型总览与能力筛选）。 */
  listAll(filter?: {
    providerId?: string;
    capability?: string;
  }): Promise<ModelView[]>;
  /** 查询详情读模型。 */
  findViewById(id: string): Promise<ModelView | null>;
  /** 聚合装载：变更前取实体。 */
  findById(id: string): Promise<ProviderModel | null>;
  /** 按逻辑调用名取读模型（resolveModel 辅助路径）。 */
  findByLogicalKey(logicalKey: string): Promise<ModelView | null>;
  /** logicalKey 唯一性校验。 */
  existsByLogicalKey(logicalKey: string): Promise<boolean>;
  /** 同服务商下上游模型名唯一性校验。 */
  existsByProviderModel(providerId: string, modelId: string): Promise<boolean>;
  /** 注册模型，返回创建后的读模型。 */
  create(model: ProviderModel): Promise<ModelView>;
  /** 只保存明确提交的配置字段，不写回其他配置或启停状态。 */
  saveConfiguration(
    model: ProviderModel,
    fields: readonly ModelConfigurationField[],
  ): Promise<void>;
  /** 只保存启停状态。 */
  saveEnabled(model: ProviderModel): Promise<void>;
  /** 物理删除；有计量/价格版本引用时由外键 Restrict 拒绝（应用层翻译为 409）。 */
  remove(id: string): Promise<void>;
}

/** 模型配置字段白名单；显式 null 清除参数，undefined 表示不写入。 */
export type ModelConfigurationField =
  | 'displayName'
  | 'capabilities'
  | 'defaultParams';
