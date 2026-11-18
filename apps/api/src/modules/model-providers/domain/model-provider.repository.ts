import type { TableQueryRequest } from '@cip/shared';
import type { ModelProvider } from './model-provider.entity';

/** 注入令牌：模块内以 useClass 绑定 infrastructure 实现。 */
export const PROVIDER_REPOSITORY = Symbol('PROVIDER_REPOSITORY');

/** 供应商读模型（后台视图）：不含凭据密文；时间为 ISO 8601 字符串。 */
export interface ProviderView {
  /** 稳定标识，用于记录关联与定位。 */
  id: string;
  /** 服务商稳定短名，用于唯一识别。 */
  slug: string;
  /** 供管理界面展示的名称。 */
  name: string;
  /** 服务商 API 接入地址。 */
  baseUrl: string;
  /** 调用超时时长，单位毫秒；为空时不附加服务商超时限制。 */
  timeoutMs: number | null;
  /** 每分钟调用上限；为空时不设置此项服务商限制。 */
  rateLimitPerMinute: number | null;
  /** 同时执行调用的上限；为空时不设置此项服务商限制。 */
  maxConcurrent: number | null;
  /** 能力是否可用，由调用方按当前上下文判定。 */
  enabled: boolean;
  /** 当前服务商已注册的模型数量。 */
  modelCount: number;
  /** 创建时间的 ISO 8601 表示。 */
  createdAt: string;
}

/** 供应商聚合持久化端口；凭据只以密文形态进出。 */
export interface ProviderRepository {
  /**
   * 查询路径：表格结构化查询（POST /ai/providers/query 语义）。
   * 入参为已校验的规范请求；多列排序后追加唯一 ID tie-break；items/total 同条件。
   */
  queryTable(query: TableQueryRequest): Promise<{
    items: ProviderView[];
    total: number;
  }>;
  /** 全量聚合装载（网关工厂用：读模型不含密文，密文只能从聚合取）。 */
  listAggregates(): Promise<ModelProvider[]>;
  /** 按 ID 查询公开详情，不加载整个列表。 */
  findViewById(id: string): Promise<ProviderView | null>;
  /** 按主键装载实体；不存在时返回 null。 */
  findById(id: string): Promise<ModelProvider | null>;
  /** 按服务商短名装载实体；不存在时返回 null。 */
  findBySlug(slug: string): Promise<ModelProvider | null>;
  /** 检查服务商短名是否已被占用。 */
  existsBySlug(slug: string): Promise<boolean>;
  /** 新建供应商，返回创建后的读模型。 */
  create(provider: ModelProvider): Promise<ProviderView>;
  /** 只保存本次配置字段；未轮换凭据时不写回密文，不触碰启停状态。 */
  saveConfiguration(
    provider: ModelProvider,
    fields: readonly ProviderConfigurationField[],
  ): Promise<void>;
  /** 只保存启停状态。 */
  saveEnabled(provider: ModelProvider): Promise<void>;
  /** 物理删除；模型仍挂载时由外键 Restrict 拒绝（应用层翻译为 409）。 */
  remove(id: string): Promise<void>;
}

/** 供应商配置可写字段；凭据仅在调用方明确轮换时出现。 */
export type ProviderConfigurationField =
  | 'name'
  | 'baseUrl'
  | 'apiKeyCipher'
  | 'timeoutMs'
  | 'rateLimitPerMinute'
  | 'maxConcurrent';
