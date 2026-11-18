import { PERMISSION } from '@cip/shared';
import { Injectable } from '@nestjs/common';
import { env } from '../../../config/env';
import {
  type EffectivePermissionResult,
  isAllowed,
} from '../domain/effective-permission.entity';

/** 内部服务令牌能力：与 `/internal/*` 动作一一对应。 */
export const INTERNAL_CAPABILITIES = [
  'runs:start',
  'reports:append',
  'artifacts:write',
] as const;

/** 内部服务令牌动作。 */
export type InternalAction = (typeof INTERNAL_CAPABILITIES)[number];

/** 内部动作对应的平台权限点：写产物同时要求 `artifact:write`。 */
export function requiredPermissionFor(action: InternalAction): string {
  return action === 'artifacts:write'
    ? PERMISSION.artifact.write.code
    : 'agentic:internal';
}

/** 服务令牌的有效权限：能力 ∩ 服务权限 ∩ 令牌范围（∩ 时间窗，V0 无）。 */
@Injectable()
export class EffectivePermissionService {
  /** 判定内部动作是否允许访问某工单范围；window 缺省不限。 */
  checkInternal(
    action: InternalAction,
    scopeKey: string | null,
    now: Date = new Date(),
    window?: { from?: Date; to?: Date },
  ): EffectivePermissionResult {
    const requiredPermission = requiredPermissionFor(action);
    return isAllowed({
      capability: action,
      capabilities: INTERNAL_CAPABILITIES,
      requiredPermission,
      actorPermissions: ['agentic:internal', requiredPermission],
      resourceScope: scopeKey,
      allowedScopes: parseScopes(env.INTERNAL_API_SCOPES),
      now,
      ...(window ? { window } : {}),
    });
  }
}

/** 解析令牌范围：`*`/空表示不限。 */
function parseScopes(raw: string): string[] | null {
  const scopes = raw
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean);
  if (scopes.length === 0 || scopes.includes('*')) return null;
  return scopes;
}
