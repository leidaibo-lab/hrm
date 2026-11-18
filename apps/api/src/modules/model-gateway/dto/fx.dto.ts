import { z } from 'zod';

/** 汇率写入 schema：1 单位原币折合多少 USD，只追加。 */
export const createFxSchema = z.object({
  quoteCurrency: z.string().regex(/^[A-Z]{3}$/, '币种必须是 3 位大写代码'),
  rateToBase: z
    .string()
    .regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,8})?$/, '汇率最多 8 位小数'),
  effectiveFrom: z.string().min(1),
});

export type CreateFxDto = z.infer<typeof createFxSchema>;

export const fxViewSchema = z.object({
  id: z.string(),
  baseCurrency: z.string(),
  quoteCurrency: z.string(),
  rateToBase: z.string(),
  effectiveFrom: z.string(),
  source: z.string(),
  createdAt: z.string(),
});

export type FxViewDto = z.infer<typeof fxViewSchema>;
