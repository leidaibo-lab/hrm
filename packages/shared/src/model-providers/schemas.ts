import { z } from 'zod';
import {
  defaultModelParamsSchema,
  modelCapabilitiesSchema,
} from './capabilities';

/**
 * 模型服务商表单/契约 schema（ADR-0015）：三端唯一来源（forms.md 规则 1）。
 * 视图 schema 留在 api（出站白名单），此处只承载写入形态。
 */
export const modelProviderSlugSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, '仅允许小写字母、数字与中划线');

export const createProviderSchema = z.object({
  slug: modelProviderSlugSchema,
  name: z.string().min(1).max(64),
  baseUrl: z.url(),
  /** API Key 明文仅出现在创建/轮换请求里，响应永不回传。 */
  apiKey: z.string().min(1).max(512),
  timeoutMs: z.number().int().positive().nullish(),
  rateLimitPerMinute: z.number().int().positive().nullish(),
  maxConcurrent: z.number().int().positive().nullish(),
});

export type CreateProviderDto = z.infer<typeof createProviderSchema>;

export const updateProviderSchema = z.object({
  name: z.string().min(1).max(64),
  baseUrl: z.url(),
  /** 传入 = 轮换凭据；省略 = 保持不变。 */
  apiKey: z.string().min(1).max(512).optional(),
  timeoutMs: z.number().int().positive().nullish(),
  rateLimitPerMinute: z.number().int().positive().nullish(),
  maxConcurrent: z.number().int().positive().nullish(),
});

export type UpdateProviderDto = z.infer<typeof updateProviderSchema>;

/** 字段型状态更新：独立子资源 PUT /:id/enabled（architecture.md 路由规则 7）。 */
export const setEnabledSchema = z.object({
  enabled: z.boolean(),
});

export type SetEnabledDto = z.infer<typeof setEnabledSchema>;

export const createModelSchema = z.object({
  modelId: z.string().min(1).max(200),
  logicalKey: modelProviderSlugSchema,
  displayName: z.string().min(1).max(64),
  capabilities: modelCapabilitiesSchema,
  defaultParams: defaultModelParamsSchema.nullish(),
});

export type CreateModelDto = z.infer<typeof createModelSchema>;

export const updateModelSchema = z.object({
  displayName: z.string().min(1).max(64).optional(),
  capabilities: modelCapabilitiesSchema.optional(),
  defaultParams: defaultModelParamsSchema.nullish(),
});

export type UpdateModelDto = z.infer<typeof updateModelSchema>;

/** 每百万 token 单价；可选维度省略 = 不计价该维度。 */
export const createPricingSchema = z.object({
  currency: z
    .string()
    .regex(/^[A-Z]{3,8}$/)
    .default('USD'),
  input: z.number().nonnegative(),
  output: z.number().nonnegative(),
  cacheRead: z.number().nonnegative().nullish(),
  cacheWrite: z.number().nonnegative().nullish(),
  reasoning: z.number().nonnegative().nullish(),
  /** ISO 8601；可预设未来生效时间。 */
  effectiveFrom: z.iso.datetime(),
});

export type CreatePricingDto = z.infer<typeof createPricingSchema>;
