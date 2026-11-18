import type { ModelPricing } from './model-pricing.entity';

/** 注入令牌：模块内以 useClass 绑定 infrastructure 实现。 */
export const MODEL_PRICING_REPOSITORY = Symbol('MODEL_PRICING_REPOSITORY');

/** 价格版本读模型：状态由应用层按 now 与 effectiveFrom 推导（生效中/待生效/历史）。 */
export interface PricingVersionView {
  /** 记录标识。 */
  id: string;
  /** 模型标识。 */
  modelId: string;
  /** 币种。 */
  currency: string;
  /** 输入 token 的价格。 */
  input: string;
  /** 输出 token 的价格。 */
  output: string;
  /** 缓存读取价格。 */
  cacheRead: string | null;
  /** 缓存写入价格。 */
  cacheWrite: string | null;
  /** 推理价格。 */
  reasoning: string | null;
  /** 生效时间。 */
  effectiveFrom: string;
  /** 状态。 */
  status: 'active' | 'pending' | 'history';
  /** 创建时间。 */
  createdAt: string;
}

/** 价格版本持久化端口；调价只能新增版本（ADR-0015）。 */
export interface ModelPricingRepository {
  /** 版本列表（模型详情价格 Tab）：含生效状态投影。 */
  listByModel(modelId: string, now: Date): Promise<PricingVersionView[]>;
  /** 取 at 时点生效的版本（计量成本用）；无则 null（调用照记，cost 为空）。 */
  findEffectiveAt(modelId: string, at: Date): Promise<ModelPricing | null>;
  /** 新增版本。 */
  create(pricing: ModelPricing): Promise<PricingVersionView>;
  /** 删除版本；被用量引用时由外键 Restrict 拒绝（应用层翻译为 409）。 */
  remove(id: string): Promise<void>;
}
