import { z } from 'zod';

const amountSchema = z
  .string()
  .regex(
    /^(?:0|[1-9]\d{0,9})(?:\.\d{1,8})?$/,
    '金额必须是最多 8 位小数的十进制字符串',
  );

/** 手动价格写入 schema：单位原币 / 每百万 token，只追加。 */
export const createPriceSchema = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/, '币种必须是 3 位大写代码'),
  input: amountSchema,
  output: amountSchema,
  cacheRead: amountSchema.nullable().optional(),
  cacheWrite: amountSchema.nullable().optional(),
  reasoning: amountSchema.nullable().optional(),
  effectiveFrom: z.string().min(1),
});

export type CreatePriceDto = z.infer<typeof createPriceSchema>;

export const priceViewSchema = z.object({
  id: z.string(),
  candidateId: z.string(),
  source: z.enum(['manual', 'models_dev']),
  currency: z.string(),
  input: z.string(),
  output: z.string(),
  cacheRead: z.string().nullable(),
  cacheWrite: z.string().nullable(),
  reasoning: z.string().nullable(),
  effectiveFrom: z.string(),
  fetchedAt: z.string().nullable(),
  createdAt: z.string(),
  status: z.enum(['active', 'pending', 'history']),
});

export type PriceViewDto = z.infer<typeof priceViewSchema>;
