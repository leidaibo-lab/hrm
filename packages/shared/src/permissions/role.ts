import { perm } from './define';

/** iam 域：角色管理。 */
export const rolePermissions = {
  manage: perm('role', 'manage', '角色管理：维护角色与权限点授予关系'),
} as const;
