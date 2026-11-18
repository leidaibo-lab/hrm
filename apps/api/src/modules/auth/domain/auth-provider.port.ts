/**
 * 认证 provider 端口：api 认证方式可插拔。
 * 本阶段唯一实现为 LocalPasswordProvider；OIDC/Lark 落地时新增实现并按配置装配，
 * 会话、guard、权限体系不感知认证方式。
 */
// 请求输入类型以 shared 契约为唯一来源（契约管线规则 3），端口只承载能力面。
import type { LoginInput, RegisterInput } from '@cip/shared';

export type { LoginInput, RegisterInput };

/** provider 返回的最小用户形态；会话建立由 auth.service 统一负责。 */
export interface AuthenticatedUser {
  /** 平台用户 id。 */
  id: string;
  /** 登录名。 */
  username: string;
  /** 展示名。 */
  name: string;
  /** 邮箱；无邮箱为 null。 */
  email: string | null;
}

/**
 * 认证 provider 端口：本地账密实现可注册，外部认证实现无注册（JIT 建档在回调中）。
 */
export interface AuthProvider {
  /** provider 标识；与未来 ExternalIdentity.provider 取值对齐（local/oidc/lark/ldap）。 */
  readonly kind: string;
  /** 校验凭据并返回用户；失败返回 null。 */
  authenticate(input: LoginInput): Promise<AuthenticatedUser | null>;
  /** 注册本地账号；外部 provider 不实现。 */
  register?(input: RegisterInput): Promise<AuthenticatedUser>;
}

/** auth 模块 DI token：认证 provider 端口的注入键（实现按配置装配）。 */
export const AUTH_PROVIDER = Symbol('AUTH_PROVIDER');
