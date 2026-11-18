import { z } from 'zod';

/** 角色标识规则：小写字母开头，字母数字连字符。 */
export const roleCodeSchema = z
  .string()
  .min(2)
  .max(32)
  .regex(/^[a-z][a-z0-9-]*$/, '角色标识仅限小写字母、数字与连字符，字母开头');

/** 角色创建请求体（跨端契约：web 表单预校验与 api 入站校验同源）。 */
export const createRoleSchema = z.object({
  code: roleCodeSchema,
  name: z.string().min(1).max(64),
  description: z.string().max(200).nullish(),
});

export type CreateRoleDto = z.infer<typeof createRoleSchema>;

/** 角色基本信息编辑合同。 */
export const updateRoleInputSchema = createRoleSchema.pick({
  name: true,
  description: true,
});

/** 全量权限替换合同。 */
export const setRolePermissionsInputSchema = z.object({
  permissionCodes: z.array(z.string()).max(200),
});
