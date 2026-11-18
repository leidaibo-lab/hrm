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

/**
 * 用量报表表格查询定义（安全边界）：modelId 开放值域（按模型 ID 多选）；
 * caller 文本；status 枚举；createdAt 日期；cost/latencyMs 仅排序不筛选。
 */
export const usagesQueryDef = defineTableQuery({
  fields: {
    modelId: field.enum(null, {
      sortable: false,
      filter: enumOperators,
    }),
    caller: field.text({
      searchable: true,
      sortable: false,
      filter: textOperators,
    }),
    status: field.enum(['success', 'failed', 'rate_limited'], {
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

/** POST /ai/usages/query 请求 schema（字段/操作符白名单校验，违规 400）。 */
export const usageQueryBodySchema = buildTableQuerySchema(usagesQueryDef);

export const usageItemSchema = z.object({
  id: z.string(),
  modelId: z.string(),
  modelName: z.string(),
  providerSlug: z.string(),
  inputTokens: z.number().int(),
  outputTokens: z.number().int(),
  reasoningTokens: z.number().int(),
  cachedInputTokens: z.number().int(),
  cacheWriteTokens: z.number().int(),
  cost: z.string().nullable(),
  latencyMs: z.number().int().nullable(),
  status: z.enum(['success', 'failed', 'rate_limited']),
  caller: z.string().nullable(),
  traceId: z.string().nullable(),
  createdAt: z.string(),
});

export type UsageItemDto = z.infer<typeof usageItemSchema>;

/** 汇总（response.meta）：与 items 使用相同筛选条件，同过滤范围跨页统计。 */
export const usageSummarySchema = z.object({
  totalCalls: z.number().int(),
  successCount: z.number().int(),
  failedCount: z.number().int(),
  rateLimitedCount: z.number().int(),
  totalInputTokens: z.number().int(),
  totalOutputTokens: z.number().int(),
  totalCost: z.string().nullable(),
});

export type UsageSummaryDto = z.infer<typeof usageSummarySchema>;

/** POST /ai/usages/query 响应：{ items, total, meta } 裸载荷，HTTP 200。 */
export const usageQueryResponseSchema = tableQueryResponse(
  usageItemSchema,
  usageSummarySchema,
);
