// 供应商写入 schema 是跨端契约（表单单源），唯一来源在 @cip/shared；此处只保留域内再导出。
export {
  type CreateProviderDto,
  createProviderSchema,
  type SetEnabledDto,
  setEnabledSchema,
  type UpdateProviderDto,
  updateProviderSchema,
} from '@cip/shared';

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
 * 供应商表格查询定义（安全边界）：status 为 enabled 布尔列的显式投影（infra 映射）。
 */
export const providersQueryDef = defineTableQuery({
  fields: {
    name: field.text({
      searchable: true,
      sortable: true,
      filter: textOperators,
    }),
    slug: field.text({
      searchable: true,
      sortable: true,
      filter: textOperators,
    }),
    baseUrl: field.text({
      searchable: true,
      sortable: false,
      filter: textOperators,
    }),
    status: field.enum(['enabled', 'disabled'], {
      sortable: true,
      filter: enumOperators,
    }),
    createdAt: field.date({ sortable: true, filter: dateOperators }),
  },
  defaultSort: [{ field: 'createdAt', direction: SortDirection.Asc }],
  maxPageSize: 100,
  maxSortRules: 5,
  maxQLength: 64,
});

/** POST /ai/providers/query 请求 schema（字段/操作符白名单校验，违规 400）。 */
export const providerQueryBodySchema = buildTableQuerySchema(providersQueryDef);

export const providerViewSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  baseUrl: z.string(),
  timeoutMs: z.number().int().nullable(),
  rateLimitPerMinute: z.number().int().nullable(),
  maxConcurrent: z.number().int().nullable(),
  enabled: z.boolean(),
  modelCount: z.number().int(),
  createdAt: z.string(),
});

export type ProviderViewDto = z.infer<typeof providerViewSchema>;

/** POST /ai/providers/query 响应：{ items, total } 裸载荷，HTTP 200。 */
export const providerQueryResponseSchema =
  tableQueryResponse(providerViewSchema);

export const testConnectionResultSchema = z.object({
  ok: z.boolean(),
  modelCount: z.number().int().optional(),
  latencyMs: z.number().int().optional(),
  error: z.string().optional(),
});

export type TestConnectionResultDto = z.infer<
  typeof testConnectionResultSchema
>;
