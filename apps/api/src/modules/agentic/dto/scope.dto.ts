import { z } from 'zod';

/** 授权范围成员请求。 */
export const grantScopeMemberSchema = z.object({
  /** 平台用户标识。 */
  userId: z.string().min(1),
});

/** 授权范围成员请求类型。 */
export type GrantScopeMemberRequest = z.infer<typeof grantScopeMemberSchema>;
