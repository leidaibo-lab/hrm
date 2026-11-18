/** 认证后的请求上下文用户：SessionGuard 挂载，业务代码经 @CurrentUser() 取用。 */
export interface SessionUser {
  /** 记录标识。 */
  id: string;
  /** 登录用户名。 */
  username: string;
  /** 名称。 */
  name: string;
  /** 邮箱地址；未设置时为空。 */
  email: string | null;
  /** 展开后的权限点集合；"*" 表示全量（super-admin）。 */
  permissions: string[];
}
