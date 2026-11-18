import {
  AbilityBuilder,
  createMongoAbility,
  type MongoAbility,
} from '@casl/ability';
import { agentPermissions } from './agent';
import { artifactPermissions } from './artifact';
import { auditPermissions } from './audit';
import type { PermissionDef } from './define';
import { modelGatewayPermissions } from './model-gateway';
import { modelProviderPermissions } from './model-provider';
import { navigationPermissions } from './navigation';
import { permissionPointPermissions } from './permission-point';
import { policyPermissions } from './policy';
import { rolePermissions } from './role';
import { sourcePermissions } from './source';
import { ticketPermissions } from './ticket';
import { userPermissions } from './user';

export type { PermissionDef } from './define';
export { perm } from './define';

/**
 * 三端共用的权限点目录：唯一事实源。
 * 新增权限点在对应资源域文件登记；resource 撞名或 code 拼错由编译期类型拦截。
 */
export const PERMISSION = {
  user: userPermissions,
  role: rolePermissions,
  navigation: navigationPermissions,
  permissionPoint: permissionPointPermissions,
  modelGateway: modelGatewayPermissions,
  modelProvider: modelProviderPermissions,
  ticket: ticketPermissions,
  policy: policyPermissions,
  audit: auditPermissions,
  source: sourcePermissions,
  agent: agentPermissions,
  artifact: artifactPermissions,
} as const;

/** 目录分组键联合：PERMISSION 常量的资源域键名（camelCase），用于目录分组索引而非 ability 判定。 */
export type PermissionResource = keyof typeof PERMISSION;

type CatalogEntry = {
  [R in PermissionResource]: (typeof PERMISSION)[R][keyof (typeof PERMISSION)[R]];
}[PermissionResource];

/** 全部已登记权限点 code 的联合类型；各端引用权限点时以此为准。 */
export type PermissionCode = CatalogEntry['code'];

/** ability 的 subject 联合：目录条目的 resource 段（与权限点 code 前缀一致，kebab 形态）。 */
export type PermissionSubject = CatalogEntry['resource'];

/** 目录内置受控动词；目录新增 action 自动并入联合类型。 */
type BuiltinAction = 'read' | 'create' | 'update' | 'delete' | 'manage';
type CatalogAction = CatalogEntry['action'];

/** 权限动作联合类型：目录声明的受控动词与内置动词。 */
export type PermissionAction = CatalogAction | BuiltinAction;

/** 类型强化的应用级 ability；subject 为权限点 code 的资源段。 */
export type AppAbility = MongoAbility<
  [PermissionAction, PermissionSubject | 'all']
>;

/** 权限点目录的扁平清单：api 启动同步与权限矩阵快照的唯一输入。 */
export const PERMISSION_CATALOG: readonly PermissionDef[] = Object.values(
  PERMISSION,
).flatMap((group) => Object.values(group));

/** code → 目录条目索引：buildAbility 与调用方共用同一解析，目录是唯一事实源。 */
const CODE_INDEX: ReadonlyMap<string, PermissionDef> = new Map(
  PERMISSION_CATALOG.map((def) => [def.code, def]),
);

/**
 * 由权限点集合构建 CASL ability；前后端共用同一实现（同一份语义，同一份判定）。
 * @param permissions - 会话权限点集合；"*" 表示全量（super-admin）。
 * @throws 权限点不在目录中（含分隔符缺失等非法形态）时抛出——权限集合是受控数据，
 *         非法形态说明上游缺陷；subject/action 取目录条目而非字符串拆分，杜绝 code 形态与键名漂移。
 */
export function buildAbility(permissions: readonly string[]): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
  if (permissions.includes('*')) {
    can('manage', 'all');
    return build();
  }
  for (const code of permissions) {
    const def = CODE_INDEX.get(code);
    if (!def) {
      throw new Error(`非法权限点: ${code}`);
    }
    // 目录条目的 resource/action 为 string 宽化形态，按字面量联合窄化（受控数据）
    can(def.action as PermissionAction, def.resource as PermissionSubject);
  }
  return build();
}
