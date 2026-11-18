import { z } from 'zod';

/** 权限点摘要覆盖：null 恢复目录默认。 */
export const updatePermissionSummarySchema = z.object({
  summary: z.string().min(1).max(120).nullable(),
});

export type UpdatePermissionSummaryDto = z.infer<
  typeof updatePermissionSummarySchema
>;

export const permissionPointViewSchema = z.object({
  code: z.string(),
  resource: z.string(),
  action: z.string(),
  summary: z.string(),
  defaultSummary: z.string(),
  state: z.enum(['active', 'deprecated']),
});

export type PermissionPointViewDto = z.infer<typeof permissionPointViewSchema>;
