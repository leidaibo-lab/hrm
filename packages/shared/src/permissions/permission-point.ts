import { perm } from './define';

/** iam 域：权限点元数据管理（展示摘要覆盖）。 */
export const permissionPointPermissions = {
  manage: perm('permission-point', 'manage', '权限点管理：调整权限点展示摘要'),
} as const;
