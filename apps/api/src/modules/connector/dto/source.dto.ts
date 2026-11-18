import { z } from 'zod';

/** 创建来源实例请求。 */
export const createSourceSchema = z.object({
  sourceType: z.enum(['lark', 'zentao', 'gitlab']),
  name: z.string().trim().min(1).max(100),
  config: z.record(z.string(), z.unknown()),
  botId: z.string().min(1).optional(),
});

/** 创建来源实例请求类型。 */
export type CreateSourceRequest = z.infer<typeof createSourceSchema>;

/** 修改来源实例请求。 */
export const updateSourceSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  botId: z.string().min(1).nullable().optional(),
});

/** 修改来源实例请求类型。 */
export type UpdateSourceRequest = z.infer<typeof updateSourceSchema>;
