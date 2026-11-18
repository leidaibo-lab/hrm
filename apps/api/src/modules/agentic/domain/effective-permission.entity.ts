/** 有效权限判定输入：机器人能力 ∩ 触发人权限 ∩ 资源范围 ∩ 时间窗。 */
export interface EffectivePermissionInput {
  /** 本次请求的能力（工具/动作标识）。 */
  capability: string;
  /** 机器人/角色具备的能力集合。 */
  capabilities: readonly string[];
  /** 本次请求需要的权限点。 */
  requiredPermission: string;
  /** 触发人（或服务令牌）持有的权限点；"*" 表示全量。 */
  actorPermissions: readonly string[];
  /** 资源所属范围；null 表示无范围限制。 */
  resourceScope: string | null;
  /** 允许访问的范围集合；null 表示不限。 */
  allowedScopes: readonly string[] | null;
  /** 判定时刻。 */
  now: Date;
  /** 有效时间窗；缺省不限。 */
  window?: {
    /** 生效起点；缺省不限制。 */
    from?: Date;
    /** 生效终点；缺省不限制。 */
    to?: Date;
  };
}

/** 有效权限判定结果。 */
export interface EffectivePermissionResult {
  /** 是否允许。 */
  allowed: boolean;
  /** 拒绝原因；允许时为空。 */
  reasons: string[];
}

/** 有效权限判定：任一条件不满足即拒绝并返回可审计原因。 */
export function isAllowed(
  input: EffectivePermissionInput,
): EffectivePermissionResult {
  const reasons: string[] = [];
  if (!input.capabilities.includes(input.capability))
    reasons.push('capability_denied');
  if (
    !input.actorPermissions.includes('*') &&
    !input.actorPermissions.includes(input.requiredPermission)
  )
    reasons.push('permission_denied');
  if (
    input.allowedScopes !== null &&
    input.resourceScope !== null &&
    !input.allowedScopes.includes(input.resourceScope)
  )
    reasons.push('scope_denied');
  if (input.window?.from && input.now < input.window.from)
    reasons.push('window_not_started');
  if (input.window?.to && input.now > input.window.to)
    reasons.push('window_expired');
  return { allowed: reasons.length === 0, reasons };
}
