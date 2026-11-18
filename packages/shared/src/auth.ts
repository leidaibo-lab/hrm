import { z } from 'zod';

/** 密码策略：8–72 位；强度增强后续按需收紧。 */
export const passwordSchema = z
  .string()
  .min(8, '密码至少 8 位')
  .max(72, '密码最多 72 位');

/** 登录请求体（跨端契约：web 表单预校验与 api 入站校验同源）。 */
export const loginSchema = z.object({
  username: z.string().min(1, '用户名必填').max(64),
  password: z.string().min(1, '密码必填').max(72),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** 注册请求体；注册用户无角色无权限，由管理员分配。 */
export const registerSchema = z.object({
  username: z
    .string()
    .min(3, '用户名至少 3 位')
    .max(32, '用户名最多 32 位')
    .regex(/^[a-zA-Z0-9_-]+$/, '用户名仅限字母、数字、下划线与连字符'),
  name: z.string().min(1, '显示名必填').max(64),
  email: z.email('邮箱格式不正确'),
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
