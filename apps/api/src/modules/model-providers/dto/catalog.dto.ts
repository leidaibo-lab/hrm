import { z } from 'zod';

/** models.dev 目录中的单个模型基线（导入向导预填用；价格与能力可改后保存）。 */
export const catalogModelSchema = z.object({
  modelId: z.string(),
  displayName: z.string(),
  reasoning: z.boolean(),
  toolCall: z.boolean(),
  structuredOutput: z.boolean(),
  imageInput: z.boolean(),
  contextWindow: z.number().int().nullable(),
  maxOutputTokens: z.number().int().nullable(),
  /** USD / 每百万 token；models.dev 未收录为 null。 */
  input: z.number().nullable(),
  output: z.number().nullable(),
  cacheRead: z.number().nullable(),
  cacheWrite: z.number().nullable(),
});

export type CatalogModelDto = z.infer<typeof catalogModelSchema>;

export const catalogProviderSchema = z.object({
  providerId: z.string(),
  name: z.string(),
  baseUrl: z.string().nullable(),
  models: z.array(catalogModelSchema),
});

export type CatalogProviderDto = z.infer<typeof catalogProviderSchema>;
