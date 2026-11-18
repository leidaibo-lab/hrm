import type { SortRule } from '@/components/table-view';

/** iam 域 queryKey 工厂：[域, 资源, 参数对象]。 */
export const iamKeys = {
  users: (page: number, pageSize: number, sort: SortRule[] = []) =>
    ['iam', 'users', { page, pageSize, sort }] as const,
  roles: (sort: SortRule[] = []) => ['iam', 'roles', { sort }] as const,
  role: (id: string) => ['iam', 'role', id] as const,
  permissionPoints: ['iam', 'permission-points'] as const,
  navigationNodes: ['iam', 'navigation-nodes'] as const,
  /** 非表格用户列表键（命令面板）；整族失效用 usersListRoot。 */
  usersList: (page: number, pageSize: number, q: string) =>
    ['iam-users-list', page, pageSize, q] as const,
  usersListRoot: ['iam-users-list'] as const,
  /** 非表格角色列表键（命令面板、CSV 导出）；整族失效用 rolesListRoot。 */
  rolesList: (q: string, all: boolean) => ['iam-roles-list', q, all] as const,
  rolesListRoot: ['iam-roles-list'] as const,
};
