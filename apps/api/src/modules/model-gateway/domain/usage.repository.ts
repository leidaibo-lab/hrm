import type { TableQueryRequest } from '@cip/shared';

/** 用量仓储注入令牌。 */
export const USAGE_REPOSITORY = Symbol('USAGE_REPOSITORY');

/** 计量入队端口注入令牌。 */
export const USAGE_SINK_PORT = Symbol('USAGE_SINK_PORT');

/** 用量状态：与 model_gateway_usage_status 枚举一致。 */
export type UsageStatus = 'success' | 'failed' | 'rate_limited' | 'cancelled';

/** 价格来源：缺失时仍保留用量行，成本为空。 */
export type UsagePriceSource = 'manual' | 'models_dev' | 'missing';

/** 一次尝试的计量输入：价格与汇率由计量消费者在调用完成时解析。 */
export interface UsageAttemptInput {
  /** 单次尝试的幂等键，同时作为队列 jobId。 */
  callId: string;
  /** 贯穿运行的追踪标识；脚本直调可为空。 */
  traceId: string | null;
  /** 调用方标识（agent / admin-test / script）。 */
  caller: string | null;
  /** 逻辑模型主键，用于成本归因。 */
  logicalModelId: string;
  /** 实际命中的候选主键。 */
  candidateId: string;
  /** 空间标识；缺失表示无空间上下文。 */
  spaceId: string | null;
  /** Agent 标识；缺失表示无 Agent 上下文。 */
  agentKey: string | null;
  /** 输入 token 总量（含缓存读写）。 */
  inputTokens: number;
  /** 输出 token 总量（含推理）。 */
  outputTokens: number;
  /** 缓存读取 token 数。 */
  cacheReadTokens: number;
  /** 缓存写入 token 数。 */
  cacheWriteTokens: number;
  /** 推理 token 数。 */
  reasoningTokens: number;
  /** 本次尝试的终态。 */
  status: UsageStatus;
  /** 失败时的业务错误码。 */
  errorCode: string | null;
  /** 本次尝试耗时（毫秒）。 */
  latencyMs: number | null;
}

/** 用量落库行：输入 + 调用完成时冻结的价格、汇率与成本快照。 */
export interface UsageRecordData extends UsageAttemptInput {
  /** 冻结的价格版本主键；缺价时为空。 */
  priceId: string | null;
  /** 价格来源：手动、目录或缺失。 */
  priceSource: UsagePriceSource;
  /** 价格原币种（ISO 4217）。 */
  currency: string | null;
  /** 原币成本，十进制字符串。 */
  costOriginal: string | null;
  /** 折算 USD 后的成本，十进制字符串。 */
  cost: string | null;
  /** 冻结的汇率（1 原币折合 USD）。 */
  fxRate: string | null;
  /** 冻结的汇率版本主键。 */
  fxRateId: string | null;
  /** 是否因缺汇率导致成本为空。 */
  fxMissing: boolean;
}

/** 计量入队端口：网关包装依赖，infrastructure 实现。 */
export interface UsageSinkPort {
  /** 入队一次尝试；实现负责取价、成本计算与失败告警。 */
  enqueue(input: UsageAttemptInput): Promise<void>;
}

/** 用量行读模型：一次尝试一行，只追加。 */
export interface UsageItemView {
  /** 用量行主键。 */
  id: string;
  /** 单次尝试的幂等键。 */
  callId: string;
  /** 追踪标识。 */
  traceId: string | null;
  /** 调用方标识。 */
  caller: string | null;
  /** 逻辑模型 key。 */
  logicalKey: string;
  /** 逻辑模型显示名（兼容旧报表）。 */
  modelName: string;
  /** 候选主键。 */
  candidateId: string;
  /** 供应商 slug。 */
  providerSlug: string;
  /** 供应商侧模型名。 */
  providerModelId: string;
  /** 空间标识。 */
  spaceId: string | null;
  /** Agent 标识。 */
  agentKey: string | null;
  /** 输入 token 总量。 */
  inputTokens: number;
  /** 输出 token 总量。 */
  outputTokens: number;
  /** 缓存读取 token 数。 */
  cacheReadTokens: number;
  /** 缓存读取 token 数（兼容旧报表字段）。 */
  cachedInputTokens: number;
  /** 缓存写入 token 数。 */
  cacheWriteTokens: number;
  /** 推理 token 数。 */
  reasoningTokens: number;
  /** 价格来源。 */
  priceSource: UsagePriceSource;
  /** 原币种。 */
  currency: string | null;
  /** 原币成本。 */
  costOriginal: string | null;
  /** USD 成本。 */
  cost: string | null;
  /** 是否缺汇率。 */
  fxMissing: boolean;
  /** 尝试终态。 */
  status: UsageStatus;
  /** 失败错误码。 */
  errorCode: string | null;
  /** 耗时（毫秒）。 */
  latencyMs: number | null;
  /** 记录时间（ISO 8601）。 */
  createdAt: string;
}

/** 用量汇总：与筛选条件同范围，成本按 USD 求和。 */
export interface UsageSummaryView {
  /** 尝试总数。 */
  totalCalls: number;
  /** 成功次数。 */
  successCount: number;
  /** 失败次数。 */
  failedCount: number;
  /** 限流次数。 */
  rateLimitedCount: number;
  /** 取消次数。 */
  cancelledCount: number;
  /** 输入 token 合计。 */
  totalInputTokens: number;
  /** 输出 token 合计。 */
  totalOutputTokens: number;
  /** USD 成本合计；全缺价时为空。 */
  totalCost: string | null;
  /** 缺价次数。 */
  missingPriceCount: number;
  /** 缺汇率次数。 */
  missingFxCount: number;
}

/** POST /query 的表格查询结果：items/total/meta 同条件。 */
export interface UsageTableResult {
  /** 当前页数据。 */
  items: UsageItemView[];
  /** 满足筛选条件的总行数。 */
  total: number;
  /** 与 items 同条件的汇总。 */
  meta: UsageSummaryView;
}

/** 汇总筛选条件：GET /usages/summary 使用。 */
export interface UsageSummaryFilter {
  /** 按空间过滤。 */
  spaceId?: string;
  /** 按 Agent 过滤。 */
  agentKey?: string;
  /** 按逻辑模型 key 过滤。 */
  logicalKey?: string;
  /** 起始时间（ISO 8601）。 */
  from?: string;
  /** 结束时间（ISO 8601）。 */
  to?: string;
}

/** 用量仓储端口：写入、报表查询与汇总。 */
export interface UsageRepository {
  /** 写入一次尝试的计量与成本快照。 */
  create(data: UsageRecordData): Promise<void>;
  /** 按表格查询读取用量行。 */
  queryTable(query: TableQueryRequest): Promise<UsageTableResult>;
  /** 按筛选条件汇总。 */
  summarize(filter: UsageSummaryFilter): Promise<UsageSummaryView>;
}
