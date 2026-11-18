/** 账号状态：suspended 后该用户下一请求即被拒绝。 */
export type UserStatus = 'active' | 'suspended';

/**
 * 用户聚合：平台登录账号的启停与角色绑定。
 * iam 域内用户状态变更必须经实体方法（ADR-0014 附录 A）。
 */
export class User {
  readonly id: string;
  #status: UserStatus;
  #roleIds: string[];

  private constructor(id: string, status: UserStatus, roleIds: string[]) {
    this.id = id;
    this.#status = status;
    this.#roleIds = [...roleIds];
  }

  /** 由持久化行重建（infrastructure mapper 专用入口）。 */
  static reconstitute(id: string, status: UserStatus, roleIds: string[]): User {
    return new User(id, status, roleIds);
  }

  /** 启停用户；挂起后该用户下一请求即被 SessionGuard 拒绝（会话仍存在但身份失效）。 */
  changeStatus(status: UserStatus): void {
    this.#status = status;
  }

  /** 全量替换角色绑定；角色存在性校验由应用层在调用前完成。 */
  replaceRoles(roleIds: string[]): void {
    this.#roleIds = [...new Set(roleIds)];
  }

  get status(): UserStatus {
    return this.#status;
  }

  get roleIds(): string[] {
    return [...this.#roleIds];
  }
}
