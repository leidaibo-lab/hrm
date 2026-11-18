import type { IconKey } from '../icons';
import { PERMISSION, type PermissionCode } from '../permissions';

/**
 * 导航目录条目：结构与默认文案的事实源，api 启动同步为 NavigationNode 投影。
 * path/层级/permissionCode 是契约（同步镜像，后台不可编辑）；title/icon 是默认文案（后台可覆盖）。
 */
export interface NavigationNodeDef {
  /** 稳定标识；代码重构不得变更已发布节点的 code（投影按它匹配）。 */
  readonly code: string;
  /** 父节点 code；根节点为 null。 */
  readonly parentCode: string | null;
  /** 前端路由；纯分组节点为 null。 */
  readonly path: string | null;
  /** 访问所需权限点；公开节点为 null。 */
  readonly permissionCode: PermissionCode | null;
  /** 默认标题；后台可覆盖。 */
  readonly title: string;
  /** 默认图标键；无图标为 null。 */
  readonly icon: IconKey | null;
}

/** 主应用导航目录。业务域（动态/智能体/文档等）随真实路由落地逐步登记。 */
export const NAVIGATION_CATALOG: readonly NavigationNodeDef[] = [
  {
    code: 'workspace',
    parentCode: null,
    path: '/',
    permissionCode: null,
    title: '工作台',
    icon: 'layout-dashboard',
  },
  {
    code: 'ferry',
    parentCode: null,
    path: '/tickets',
    permissionCode: PERMISSION.ticket.read.code,
    title: 'agentic',
    icon: 'route',
  },
  {
    code: 'ferry.threads',
    parentCode: 'ferry',
    path: '/threads',
    permissionCode: PERMISSION.ticket.read.code,
    title: '线程',
    icon: 'route',
  },
  {
    code: 'ferry.console',
    parentCode: 'ferry',
    path: '/console',
    permissionCode: PERMISSION.audit.read.code,
    title: '运行轨迹',
    icon: 'route',
  },
  {
    code: 'ferry.audit',
    parentCode: 'ferry',
    path: '/console/audit',
    permissionCode: PERMISSION.audit.read.code,
    title: '审计',
    icon: 'settings',
  },
  {
    code: 'ferry.policies',
    parentCode: 'ferry',
    path: '/console/policies',
    permissionCode: PERMISSION.policy.configure.code,
    title: '策略',
    icon: 'settings',
  },
  {
    code: 'ferry.sources',
    parentCode: 'ferry',
    path: '/console/sources',
    permissionCode: PERMISSION.source.configure.code,
    title: '来源',
    icon: 'settings',
  },
  {
    code: 'ferry.attention',
    parentCode: 'ferry',
    path: '/attention',
    permissionCode: PERMISSION.ticket.read.code,
    title: '待办关注',
    icon: 'inbox',
  },
  {
    code: 'admin',
    parentCode: null,
    path: '/admin',
    permissionCode: null,
    title: '平台管理',
    icon: 'settings',
  },
  {
    code: 'admin.users',
    parentCode: 'admin',
    path: '/admin/users',
    permissionCode: PERMISSION.user.manage.code,
    title: '用户管理',
    icon: 'users',
  },
  {
    code: 'admin.roles',
    parentCode: 'admin',
    path: '/admin/roles',
    permissionCode: PERMISSION.role.manage.code,
    title: '角色管理',
    icon: 'shield',
  },
  {
    code: 'admin.menus',
    parentCode: 'admin',
    path: '/admin/menus',
    permissionCode: PERMISSION.navigation.manage.code,
    title: '菜单管理',
    icon: 'menu',
  },
  {
    code: 'admin.permission-points',
    parentCode: 'admin',
    path: '/admin/permission-points',
    permissionCode: PERMISSION.role.manage.code,
    title: '权限点',
    icon: 'key-round',
  },
  {
    code: 'model-gateway.providers',
    parentCode: 'admin',
    path: '/model-gateway/providers',
    permissionCode: PERMISSION.modelGateway.read.code,
    title: '模型网关',
    icon: 'bot',
  },
  {
    code: 'model-gateway.usages',
    parentCode: 'admin',
    path: '/model-gateway/usages',
    permissionCode: PERMISSION.modelGateway.read.code,
    title: '模型用量',
    icon: 'gauge',
  },
];
