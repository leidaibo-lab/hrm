import {
  buildTableQuerySchema,
  dateOperators,
  defineTableQuery,
  enumOperators,
  field,
  SortDirection,
  tableQueryResponse,
  textOperators,
} from '@cip/shared';
import { z } from 'zod';

/**
 * 用户表格查询定义（安全边界）：字段白名单、操作符矩阵与上限的唯一声明处，
 * 请求 schema 由此派生；q 跨 name/username/email 搜索（infra 声明）。
 */
export const usersQueryDef = defineTableQuery({
  fields: {
    username: field.text({
      searchable: true,
      sortable: true,
      filter: textOperators,
    }),
    name: field.text({
      searchable: true,
      sortable: true,
      filter: textOperators,
    }),
    email: field.text({
      searchable: true,
      sortable: true,
      filter: textOperators,
    }),
    status: field.enum(['active', 'suspended'], {
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

/** POST /users/query 请求 schema（字段/操作符白名单校验，违规 400）。 */
export const userQueryBodySchema = buildTableQuerySchema(usersQueryDef);

export const setUserStatusSchema = z.object({
  status: z.enum(['active', 'suspended']),
});

export type SetUserStatusDto = z.infer<typeof setUserStatusSchema>;

export const setUserRolesSchema = z.object({
  roleIds: z.array(z.string().uuid()).max(100),
});

export type SetUserRolesDto = z.infer<typeof setUserRolesSchema>;

/** 用户视图响应 schema：出站 parse 白名单（响应 DTO 规范）。 */
export const userViewSchema = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  status: z.enum(['active', 'suspended']),
  roleIds: z.array(z.string()),
  createdAt: z.string(),
});

/** POST /users/query 响应：{ items, total } 裸载荷，HTTP 200。 */
export const userQueryResponseSchema = tableQueryResponse(userViewSchema);

export type UserViewDto = z.infer<typeof userViewSchema>;
