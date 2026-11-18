import type { SessionUser } from '../pipeline/guards';

/**
 * 权限测试工厂：构造携带指定权限集合的会话用户（"*" 表示全量）。
 * 供 PoliciesGuard 单测与未来端到端 403 用例（docker 落地后）复用——
 * 端点 403 用例模板：buildSessionUser([]) 请求受保护端点 → 期望 403 + code auth.forbidden。
 */
export function buildSessionUser(
  permissions: string[],
  overrides: Partial<SessionUser> = {},
): SessionUser {
  return {
    id: overrides.id ?? '00000000-0000-0000-0000-000000000001',
    username: overrides.username ?? 'test-user',
    name: overrides.name ?? '测试用户',
    email: overrides.email ?? null,
    permissions,
    ...overrides,
  };
}
