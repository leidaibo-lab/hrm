import { perm } from './define';

/** iam 域：导航展示覆盖管理。 */
export const navigationPermissions = {
  manage: perm(
    'navigation',
    'manage',
    '菜单管理：调整导航文案、图标、排序与显隐',
  ),
} as const;
