// 价格版本写入 schema 是跨端契约（表单单源），唯一来源在 @cip/shared；此处只保留域内再导出。
export {
  type CreatePricingDto,
  createPricingSchema,
} from '@cip/shared';

import { z } from 'zod';

export const pricingVersionViewSchema = z.object({
  id: z.string(),
  modelId: z.string(),
  currency: z.string(),
  input: z.string(),
  output: z.string(),
  cacheRead: z.string().nullable(),
  cacheWrite: z.string().nullable(),
  reasoning: z.string().nullable(),
  effectiveFrom: z.string(),
  status: z.enum(['active', 'pending', 'history']),
  createdAt: z.string(),
});

export type PricingVersionViewDto = z.infer<typeof pricingVersionViewSchema>;
