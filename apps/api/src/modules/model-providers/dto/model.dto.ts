import {
  buildTableQuerySchema,
  dateOperators,
  defaultModelParamsSchema,
  defineTableQuery,
  enumOperators,
  field,
  modelCapabilitiesSchema,
  SortDirection,
  tableQueryResponse,
  textOperators,
} from '@cip/shared';
import { z } from 'zod';

/**
 * 模型表格查询定义（安全边界）：enabled 以 enabled/disabled 枚举投影；
 * scope 明确声明 providerId（参与请求、缓存与浏览器状态隔离，服务端仍强制校验）。
 */
export const modelsQueryDef = defineTableQuery({
  fields: {
    displayName: field.text({
      searchable: true,
      sortable: true,
      filter: textOperators,
    }),
    logicalKey: field.text({
      searchable: true,
      sortable: true,
      filter: textOperators,
    }),
    enabled: field.enum(['enabled', 'disabled'], {
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

/** POST /ai/models/query 请求 schema：scope 仅开放 providerId 键。 */
export const modelQueryBodySchema = buildTableQuerySchema(modelsQueryDef, {
  scope: z.strictObject({ providerId: z.string().uuid().optional() }),
});

// 模型写入 schema 是跨端契约（表单单源），唯一来源在 @cip/shared；此处只保留域内再导出。
export {
  type CreateModelDto,
  createModelSchema,
  type DefaultModelParams as DefaultModelParamsDto,
  defaultModelParamsSchema,
  type ModelCapabilities as ModelCapabilitiesDto,
  modelCapabilitiesSchema,
  type SetEnabledDto,
  setEnabledSchema,
  type UpdateModelDto,
  updateModelSchema,
} from '@cip/shared';

const pricingRatesViewSchema = z.object({
  pricingId: z.string(),
  currency: z.string(),
  input: z.string(),
  output: z.string(),
  cacheRead: z.string().nullable(),
  cacheWrite: z.string().nullable(),
  reasoning: z.string().nullable(),
  effectiveFrom: z.string(),
});

export const modelViewSchema = z.object({
  id: z.string(),
  providerId: z.string(),
  providerSlug: z.string(),
  providerName: z.string(),
  providerEnabled: z.boolean(),
  modelId: z.string(),
  logicalKey: z.string(),
  displayName: z.string(),
  capabilities: modelCapabilitiesSchema,
  defaultParams: defaultModelParamsSchema.nullable(),
  enabled: z.boolean(),
  currentPricing: pricingRatesViewSchema.nullable(),
  createdAt: z.string(),
});

export type ModelViewDto = z.infer<typeof modelViewSchema>;

/** POST /ai/models/query 响应：{ items, total } 裸载荷，HTTP 200。 */
export const modelQueryResponseSchema = tableQueryResponse(modelViewSchema);
