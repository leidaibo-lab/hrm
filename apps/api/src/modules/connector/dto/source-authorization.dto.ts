import { z } from 'zod';

/** 创建/更新来源授权请求。 */
export const authorizeSourceSchema = z.object({
  /** 群/项目范围标识。 */
  scopeKey: z.string().min(1),
  /** 到期时间（ISO）；空为长期。 */
  expiresAt: z.string().datetime().nullable().optional(),
});

/** 创建/更新来源授权请求类型。 */
export type AuthorizeSourceRequest = z.infer<typeof authorizeSourceSchema>;
