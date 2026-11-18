/** 触发人权限解析端口的 DI 令牌。 */
export const ACTOR_PERMISSION_PORT = Symbol('ACTOR_PERMISSION_PORT');

/** 触发人权限解析：按平台用户标识展开实时权限点。 */
export interface ActorPermissionPort {
  /** 返回权限点集合；用户不存在/非 active 返回 null。 */
  permissionsOf(userId: string): Promise<string[] | null>;
}
