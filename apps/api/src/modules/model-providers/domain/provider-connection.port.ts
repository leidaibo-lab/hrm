import type { ModelProvider } from './model-provider.entity';

/** 供应商连通性能力令牌。 */
export const PROVIDER_CONNECTION_PORT = Symbol('PROVIDER_CONNECTION_PORT');

/** 连通性结果，不含供应商凭据。 */
export interface ProviderConnectionResult {
  /** 操作是否成功。 */
  ok: boolean;
  /** 模型数量。 */
  modelCount?: number;
  /** 耗时，单位为毫秒。 */
  latencyMs?: number;
  /** 错误信息。 */
  error?: string;
}

/** 供应商协议由适配器实现，应用层只消费连通性结果。 */
export interface ProviderConnectionPort {
  /** 检测供应商连接并返回结果。 */
  probe(provider: ModelProvider): Promise<ProviderConnectionResult>;
}
