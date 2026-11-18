import { z } from 'zod';

/** 目录模型基线：价格单位 USD / 每百万 token，未收录为 null。 */
export const catalogModelSchema = z.object({
  modelId: z.string(),
  displayName: z.string(),
  reasoning: z.boolean(),
  toolCall: z.boolean(),
  structuredOutput: z.boolean(),
  imageInput: z.boolean(),
  contextWindow: z.number().int().nullable(),
  maxOutputTokens: z.number().int().nullable(),
  input: z.number().nullable(),
  output: z.number().nullable(),
  cacheRead: z.number().nullable(),
  cacheWrite: z.number().nullable(),
  reasoningPrice: z.number().nullable(),
});

export type CatalogModelDto = z.infer<typeof catalogModelSchema>;

export const catalogProviderSchema = z.object({
  providerId: z.string(),
  name: z.string(),
  models: z.array(catalogModelSchema),
});

export type CatalogProviderDto = z.infer<typeof catalogProviderSchema>;

export const catalogSyncSchema = z.object({
  id: z.string(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  status: z.enum(['success', 'failed', 'partial']),
  providers: z.number().int(),
  models: z.number().int(),
  pricesWritten: z.number().int(),
  unmatched: z.number().int(),
  error: z.string().nullable(),
  createdAt: z.string(),
});

export type CatalogSyncDto = z.infer<typeof catalogSyncSchema>;
