import { z } from 'zod';

/** 来源授权视图。 */
export const sourceAuthorizationViewSchema = z.object({
  id: z.string(),
  scopeKey: z.string(),
  authorizedBy: z.string(),
  expiresAt: z.string().optional(),
  revokedAt: z.string().optional(),
  active: z.boolean(),
  createdAt: z.string(),
});

/** 来源授权列表响应。 */
export const sourceAuthorizationListResponseSchema = z.object({
  items: z.array(sourceAuthorizationViewSchema),
});
