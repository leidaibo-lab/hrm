import { z } from 'zod';

export const createModelImportSchema = z.object({
  catalogProviderId: z.string().min(1),
  modelIds: z.array(z.string().min(1)).min(1).max(100),
});
export type CreateModelImportDto = z.infer<typeof createModelImportSchema>;

export const modelImportResultSchema = z.object({
  created: z.number().int(),
  skipped: z.number().int(),
  failed: z.number().int(),
  items: z.array(
    z.object({
      modelId: z.string(),
      status: z.enum(['created', 'skipped', 'failed']),
      error: z.string().nullable(),
    }),
  ),
});
export type ModelImportResultDto = z.infer<typeof modelImportResultSchema>;
