/** 角色绑定读行形状：应用层从 repository 读模型传入（结构对齐 UserRoleBindingRow.role）。 */
export interface RoleBinding {
  /** 业务编码。 */
  code: string;
  /** 权限集合。 */
  permissions: Array<{
    /** 权限点。 */
    permissionPoint: {
      /** 业务编码。 */ code: string /** 状态。 */;
      /** 状态。 */
      state: string;
    };
  }>;
}

/**
 * 权限集合值对象：角色绑定展开为生效权限点；内置 super-admin 短路为 ["*"]。
 * 权限展开语义唯一事实源：SessionGuard 会话挂载经 UserService 调用（auth）。
 */
export class PermissionSet {
  readonly #codes: readonly string[];

  private constructor(codes: readonly string[]) {
    this.#codes = codes;
  }

  /** 由用户绑定的角色展开；仅统计 active 权限点并去重。 */
  static fromRoles(roles: readonly RoleBinding[]): PermissionSet {
    if (roles.some((role) => role.code === 'super-admin')) {
      return new PermissionSet(['*']);
    }
    const codes = roles.flatMap((role) =>
      role.permissions
        .filter((binding) => binding.permissionPoint.state === 'active')
        .map((binding) => binding.permissionPoint.code),
    );
    return new PermissionSet([...new Set(codes)]);
  }

  /** 展开后的权限点集合（副本，防止外部修改内部状态）。 */
  get codes(): string[] {
    return [...this.#codes];
  }
}
