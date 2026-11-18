import type { TableQueryRequest } from '@cip/shared';

/** 注入令牌：模块内以 useClass 绑定 infrastructure 实现。 */
export const MODEL_USAGE_REPOSITORY = Symbol('MODEL_USAGE_REPOSITORY');

/** 用量状态值：与 Prisma enum UsageStatus 一致（domain 不 import prisma）。 */
export type UsageStatusValue = 'success' | 'failed' | 'rate_limited';

/** 计量写入记录：网关计量包装的产出形态；cost 由消费者按生效价格计算。 */
export interface UsageRecord {
  /** 模型注册标识，用于关联模型配置与计量。 */
  modelId: string;
  /** 本次计价引用的价格版本标识。 */
  pricingId: string | null;
  /** 输入 token 数量。 */
  inputTokens: number;
  /** 输出 token 数量。 */
  outputTokens: number;
  /** 推理 token 数量。 */
  reasoningTokens: number;
  /** 命中缓存的输入 token 数量。 */
  cachedInputTokens: number;
  /** 写入缓存的 token 数量。 */
  cacheWriteTokens: number;
  /** 本次调用费用；未完成计价时为空。 */
  cost: number | null;
  /** 调用耗时，单位毫秒；未取得计时时为空。 */
  latencyMs: number | null;
  /** 当前业务状态，用于展示和后续操作判定。 */
  status: UsageStatusValue;
  /** 调用来源标记；未声明时为空。 */
  caller: string | null;
  /** 关联请求链路的标识。 */
  traceId: string | null;
}

/** 用量明细行（报表读模型）：金额为 Decimal 字符串。 */
export interface UsageItemView {
  /** 稳定标识，用于记录关联与定位。 */
  id: string;
  /** 模型注册标识，用于关联模型配置与计量。 */
  modelId: string;
  /** 计量明细展示的模型名称。 */
  modelName: string;
  /** 所属服务商的稳定短名。 */
  providerSlug: string;
  /** 输入 token 数量。 */
  inputTokens: number;
  /** 输出 token 数量。 */
  outputTokens: number;
  /** 推理 token 数量。 */
  reasoningTokens: number;
  /** 命中缓存的输入 token 数量。 */
  cachedInputTokens: number;
  /** 写入缓存的 token 数量。 */
  cacheWriteTokens: number;
  /** 本次调用费用；未完成计价时为空。 */
  cost: string | null;
  /** 调用耗时，单位毫秒；未取得计时时为空。 */
  latencyMs: number | null;
  /** 当前业务状态，用于展示和后续操作判定。 */
  status: UsageStatusValue;
  /** 调用来源标记；未声明时为空。 */
  caller: string | null;
  /** 关联请求链路的标识。 */
  traceId: string | null;
  /** 创建时间的 ISO 8601 表示。 */
  createdAt: string;
}

/** 报表汇总卡片数据。 */
export interface UsageSummaryView {
  /** 匹配查询条件的调用总次数。 */
  totalCalls: number;
  /** 成功调用次数。 */
  successCount: number;
  /** 失败调用次数。 */
  failedCount: number;
  /** 被限流的调用次数。 */
  rateLimitedCount: number;
  /** 匹配查询条件的输入 token 总量。 */
  totalInputTokens: number;
  /** 匹配查询条件的输出 token 总量。 */
  totalOutputTokens: number;
  /** 匹配查询条件的费用合计，使用定点数字符串表示。 */
  totalCost: string | null;
}

/** 表格查询结果：items/total/meta（汇总与明细使用相同筛选条件）。 */
export interface UsageTableResult {
  /** 当前分页返回的记录。 */
  items: UsageItemView[];
  /** 满足相同筛选条件的记录总数。 */
  total: number;
  /** 与明细使用相同查询条件的汇总数据。 */
  meta: UsageSummaryView;
}

/** 计量持久化端口：只增不改。 */
export interface ModelUsageRepository {
  /** 持久化新记录，失败时向调用方报告。 */
  create(record: UsageRecord): Promise<void>;
  /**
   * 查询路径：表格结构化查询（POST /ai/usages/query 语义）。
   * items/total/meta 使用相同筛选条件；多列排序后追加唯一 ID tie-break。
   */
  queryTable(query: TableQueryRequest): Promise<UsageTableResult>;
}
