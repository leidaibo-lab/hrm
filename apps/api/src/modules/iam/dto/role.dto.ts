// 角色创建 schema 是跨端契约，唯一来源在 @cip/shared（契约管线规则 3）；此处只保留域内再导出。
export {
  type CreateRoleDto,
  createRoleSchema,
  roleCodeSchema,
} from '@cip/shared';

import {
  buildTableQuerySchema,
  dateOperators,
  defineTableQuery,
  enumOperators,
  field,
  SortDirection,
  setRolePermissionsInputSchema,
  tableQueryResponse,
  textOperators,
  updateRoleInputSchema,
} from '@cip/shared';
import { z } from 'zod';

/**
 * 角色表格查询定义（安全边界）：isBuiltin 以 builtin/custom 枚举投影（infra 显式映射）。
 */
export const rolesQueryDef = defineTableQuery({
  fields: {
    code: field.text({
      searchable: true,
      sortable: true,
      filter: textOperators,
    }),
    name: field.text({
      searchable: true,
      sortable: true,
      filter: textOperators,
    }),
    isBuiltin: field.enum(['builtin', 'custom'], {
      sortable: true,
      filter: enumOperators,
    }),
    createdAt: field.date({ sortable: true, filter: dateOperators }),
  },
  defaultSort: [{ field: 'createdAt', direction: SortDirection.Asc }],
  maxPageSize: 100,
  maxSortRules: 5,
  maxQLength: 64,
});

/** POST /roles/query 请求 schema（字段/操作符白名单校验，违规 400）。 */
export const roleQueryBodySchema = buildTableQuerySchema(rolesQueryDef);

/** 共享的基本信息校验合同。 */
export const updateRoleSchema = updateRoleInputSchema;

export type UpdateRoleDto = z.infer<typeof updateRoleSchema>;

/** 共享的权限替换校验合同。 */
export const setRolePermissionsSchema = setRolePermissionsInputSchema;

export type SetRolePermissionsDto = z.infer<typeof setRolePermissionsSchema>;

export const roleViewSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isBuiltin: z.boolean(),
  permissionCodes: z.array(z.string()),
  createdAt: z.string(),
});

export type RoleViewDto = z.infer<typeof roleViewSchema>;

/** POST /roles/query 响应：{ items, total } 裸载荷，HTTP 200。 */
export const roleQueryResponseSchema = tableQueryResponse(roleViewSchema);
