import type { ProviderHealth } from './provider.entity';

/** 供应商仓储注入令牌。 */
export const PROVIDER_REPOSITORY = Symbol('PROVIDER_REPOSITORY');

/** 供应商完整记录：仅供应用层与基础设施使用，凭据字段永不出仓到接口。 */
export interface ProviderRecord {
  /** 记录标识。 */
  id: string;
  /** 名称。 */
  name: string;
  /** 短标识。 */
  slug: string;
  /** 接入协议。 */
  protocol: 'openai_compatible';
  /** 服务地址。 */
  baseUrl: string;
  /** API 密钥密文。 */
  apiKeyCipher: string;
  /** 目录供应商标识。 */
  catalogProviderId: string | null;
  /** 超时时间，单位为毫秒。 */
  timeoutMs: number | null;
  /** 是否启用。 */
  enabled: boolean;
  /** 健康状态。 */
  health: ProviderHealth;
  /** 熔断截止时间。 */
  openUntil: Date | null;
  /** 连续失败次数。 */
  consecutiveFailures: number;
  /** 每分钟请求数限制。 */
  rateLimitPerMinute: number | null;
  /** 最大并发数。 */
  maxConcurrent: number | null;
  /** 创建时间。 */
  createdAt: Date;
}

/** 新建供应商的存储输入；凭据由应用层加密后传入。 */
export interface ProviderCreateData {
  /** 名称。 */
  name: string;
  /** 短标识。 */
  slug: string;
  /** 服务地址。 */
  baseUrl: string;
  /** API 密钥密文。 */
  apiKeyCipher: string;
  /** 目录供应商标识。 */
  catalogProviderId: string | null;
  /** 超时时间，单位为毫秒。 */
  timeoutMs: number | null;
  /** 每分钟请求数限制。 */
  rateLimitPerMinute: number | null;
  /** 最大并发数。 */
  maxConcurrent: number | null;
}

/** 供应商可变更字段；缺省字段保持原值。 */
export interface ProviderUpdateData {
  /** 名称。 */
  name?: string;
  /** 服务地址。 */
  baseUrl?: string;
  /** API 密钥密文。 */
  apiKeyCipher?: string;
  /** 目录供应商标识。 */
  catalogProviderId?: string | null;
  /** 超时时间，单位为毫秒。 */
  timeoutMs?: number | null;
  /** 每分钟请求数限制。 */
  rateLimitPerMinute?: number | null;
  /** 最大并发数。 */
  maxConcurrent?: number | null;
}

/** 供应商仓储端口：application 依赖，infrastructure 实现。 */
export interface ProviderRepository {
  /** 列出记录。 */
  list(): Promise<ProviderRecord[]>;
  /** 按标识查询记录，不存在时返回空值。 */
  findById(id: string): Promise<ProviderRecord | null>;
  /** 判断短标识是否已存在。 */
  existsBySlug(slug: string): Promise<boolean>;
  /** 创建记录并返回结果。 */
  create(data: ProviderCreateData): Promise<ProviderRecord>;
  /** 更新指定记录并返回结果。 */
  update(id: string, data: ProviderUpdateData): Promise<ProviderRecord>;
  /** 设置记录的启用状态。 */
  setEnabled(id: string, enabled: boolean): Promise<ProviderRecord>;
}
