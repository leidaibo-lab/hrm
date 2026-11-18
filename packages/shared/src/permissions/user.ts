import { perm } from './define';

/** iam 域：用户管理。 */
export const userPermissions = {
  manage: perm('user', 'manage', '用户管理：查看用户列表、调整状态与分配角色'),
} as const;
