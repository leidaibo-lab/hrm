import { z } from 'zod';

/** 供应商写入 schema：slug 不可变，apiKey 只进不出。 */
export const createProviderSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug 只能是小写 kebab-case'),
  baseUrl: z.string().url(),
  apiKey: z.string().min(1).max(512),
  catalogProviderId: z.string().min(1).max(64).optional(),
  timeoutMs: z.number().int().positive().max(600_000).optional(),
  rateLimitPerMinute: z.number().int().positive().max(10_000_000).optional(),
  maxConcurrent: z.number().int().positive().max(10_000).optional(),
});

export type CreateProviderDto = z.infer<typeof createProviderSchema>;

/** 供应商更新 schema：slug 不可变，其余字段可选。 */
export const updateProviderSchema = createProviderSchema
  .omit({ slug: true })
  .partial();

export type UpdateProviderDto = z.infer<typeof updateProviderSchema>;

export const setProviderEnabledSchema = z.object({ enabled: z.boolean() });

export type SetProviderEnabledDto = z.infer<typeof setProviderEnabledSchema>;

export const providerViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  protocol: z.string(),
  baseUrl: z.string(),
  catalogProviderId: z.string().nullable(),
  timeoutMs: z.number().int().nullable(),
  rateLimitPerMinute: z.number().int().nullable(),
  maxConcurrent: z.number().int().nullable(),
  enabled: z.boolean(),
  health: z.string(),
  openUntil: z.string().nullable(),
  consecutiveFailures: z.number().int(),
  credentialConfigured: z.boolean(),
  createdAt: z.string(),
});

export type ProviderViewDto = z.infer<typeof providerViewSchema>;

export const providerConnectionSchema = z.object({
  ok: z.boolean(),
  latencyMs: z.number().int().optional(),
  modelCount: z.number().int().optional(),
  error: z.string().optional(),
});

export type ProviderConnectionDto = z.infer<typeof providerConnectionSchema>;
