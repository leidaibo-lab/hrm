import {
  buildTableQuerySchema,
  dateOperators,
  defineTableQuery,
  enumOperators,
  field,
  SortDirection,
  tableQueryResponse,
  textOperators,
} from '@cip/shared';
import { z } from 'zod';

/** 用量报表查询定义：归因字段文本筛选，状态枚举，时间范围与成本排序。 */
export const usagesQueryDef = defineTableQuery({
  fields: {
    logicalKey: field.text({
      searchable: true,
      sortable: false,
      filter: textOperators,
    }),
    candidateId: field.text({ sortable: false, filter: textOperators }),
    spaceId: field.text({
      searchable: true,
      sortable: false,
      filter: textOperators,
    }),
    agentKey: field.text({
      searchable: true,
      sortable: false,
      filter: textOperators,
    }),
    status: field.enum(['success', 'failed', 'rate_limited', 'cancelled'], {
      sortable: false,
      filter: enumOperators,
    }),
    createdAt: field.date({ sortable: true, filter: dateOperators }),
    cost: field.number({ sortable: true }),
    latencyMs: field.number({ sortable: true }),
  },
  defaultSort: [{ field: 'createdAt', direction: SortDirection.Desc }],
  maxPageSize: 100,
  maxSortRules: 5,
  maxQLength: 64,
});

/** POST /usages/query 请求 schema（字段/操作符白名单校验）。 */
export const usageQueryBodySchema = buildTableQuerySchema(usagesQueryDef);

export const usageItemSchema = z.object({
  id: z.string(),
  callId: z.string(),
  traceId: z.string().nullable(),
  caller: z.string().nullable(),
  logicalKey: z.string(),
  modelName: z.string(),
  candidateId: z.string(),
  providerSlug: z.string(),
  providerModelId: z.string(),
  spaceId: z.string().nullable(),
  agentKey: z.string().nullable(),
  inputTokens: z.number().int(),
  outputTokens: z.number().int(),
  cacheReadTokens: z.number().int(),
  cachedInputTokens: z.number().int(),
  cacheWriteTokens: z.number().int(),
  reasoningTokens: z.number().int(),
  priceSource: z.enum(['manual', 'models_dev', 'missing']),
  currency: z.string().nullable(),
  costOriginal: z.string().nullable(),
  cost: z.string().nullable(),
  fxMissing: z.boolean(),
  status: z.enum(['success', 'failed', 'rate_limited', 'cancelled']),
  errorCode: z.string().nullable(),
  latencyMs: z.number().int().nullable(),
  createdAt: z.string(),
});

export type UsageItemDto = z.infer<typeof usageItemSchema>;

/** 汇总：与 items 同筛选条件，成本按 USD 求和。 */
export const usageSummarySchema = z.object({
  totalCalls: z.number().int(),
  successCount: z.number().int(),
  failedCount: z.number().int(),
  rateLimitedCount: z.number().int(),
  cancelledCount: z.number().int(),
  totalInputTokens: z.number().int(),
  totalOutputTokens: z.number().int(),
  totalCost: z.string().nullable(),
  missingPriceCount: z.number().int(),
  missingFxCount: z.number().int(),
});

export type UsageSummaryDto = z.infer<typeof usageSummarySchema>;

/** POST /usages/query 响应：{ items, total, meta } 裸载荷，HTTP 200。 */
export const usageQueryResponseSchema = tableQueryResponse(
  usageItemSchema,
  usageSummarySchema,
);

/** GET /usages/summary 查询参数：文本归因与时间范围。 */
export const usageSummaryQuerySchema = z.object({
  spaceId: z.string().min(1).optional(),
  agentKey: z.string().min(1).optional(),
  logicalKey: z.string().min(1).optional(),
  from: z.string().min(1).optional(),
  to: z.string().min(1).optional(),
});

export type UsageSummaryQueryDto = z.infer<typeof usageSummaryQuerySchema>;
