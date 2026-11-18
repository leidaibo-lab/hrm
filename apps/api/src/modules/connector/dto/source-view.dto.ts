import { z } from 'zod';

/** 来源实例视图。 */
export const sourceViewSchema = z.object({
  id: z.string(),
  sourceType: z.string(),
  name: z.string(),
  botId: z.string().optional(),
  config: z.record(z.string(), z.unknown()),
  enabled: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** 来源实例列表响应。 */
export const sourceListResponseSchema = z.object({
  items: z.array(sourceViewSchema),
});

/** 来源健康响应。 */
export const sourceHealthResponseSchema = z.object({
  items: z.array(
    z.object({
      entry: z.string(),
      state: z.string(),
      detail: z.string().optional(),
      checkedAt: z.string(),
    }),
  ),
});
