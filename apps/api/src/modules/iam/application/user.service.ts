import type { TableQueryRequest } from '@cip/shared';
import { ERROR_CODE } from '@cip/shared';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PermissionSet } from '../domain/permission-set.entity';
import {
  ROLE_REPOSITORY,
  type RoleRepository,
} from '../domain/role.repository';
import type { UserStatus } from '../domain/user.entity';
import {
  USER_REPOSITORY,
  type UserCredentialView,
  type UserRepository,
  type UserView,
} from '../domain/user.repository';

/** 会话用户读模型（查询路径直返）：结构兼容 pipeline/guards 的 SessionUser，本域不 import common。 */
export interface SessionUserView {
  /** 稳定标识，用于记录关联与定位。 */
  id: string;
  /** 登录账号名，用于认证与唯一性校验。 */
  username: string;
  /** 供管理界面展示的名称。 */
  name: string;
  /** 联系邮箱；未提供时为空。 */
  email: string | null;
  /** 展开后的权限点集合；"*" 表示全量（super-admin）。 */
  permissions: string[];
}

/** 用户管理服务（应用层）：列表、启停与角色分配；事务边界与资源级判定在此。 */
@Injectable()
export class UserService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
  ) {}

  /**
   * 用户表格查询（POST /users/query 用例）：规范请求透传仓储。
   * 字段/操作符白名单已由 DTO 校验，仓储实现再做绑定白名单（fail-fast）；
   * 用户管理无资源级 scope，权限由 guard 按 user:manage 判定。
   */
  async queryTable(query: TableQueryRequest): Promise<{
    items: UserView[];
    total: number;
  }> {
    return this.users.queryTable(query);
  }

  /**
   * 会话用户视图（SessionGuard 每请求调用）：不存在或非 active 返回 null（guard 统一按会话过期 401）。
   * 查询路径：读模型直返不装载聚合；权限点实时展开，撤销对下一请求即生效。
   */
  async findSessionUser(userId: string): Promise<SessionUserView | null> {
    const view = await this.users.findViewById(userId);
    if (view?.status !== 'active') return null;
    const bindings = await this.users.findRoleBindings(userId);
    return {
      id: view.id,
      username: view.username,
      name: view.name,
      email: view.email,
      permissions: PermissionSet.fromRoles(
        bindings.map((binding) => binding.role),
      ).codes,
    };
  }

  /**
   * 启停用户；挂起后该用户下一请求即被 SessionGuard 拒绝（会话仍存在但身份失效）。
   * @throws 用户不存在时 404。
   */
  async setStatus(userId: string, status: UserStatus): Promise<UserView> {
    const user = await this.mustFindById(userId);
    user.changeStatus(status);
    await this.users.saveStatus(user);
    return this.mustFindViewById(userId);
  }

  /**
   * 全量替换用户角色绑定。
   * @throws 用户或任一角色不存在时 404。
   */
  async setRoles(userId: string, roleIds: string[]): Promise<UserView> {
    const user = await this.mustFindById(userId);
    const existingRoleIds = await this.roles.findExistingIds(roleIds);
    if (existingRoleIds.length !== new Set(roleIds).size) {
      throw new NotFoundException({
        code: ERROR_CODE.role.notFound,
        message: '存在无效角色',
      });
    }
    user.replaceRoles(roleIds);
    await this.users.replaceRoles(user);
    return this.mustFindViewById(userId);
  }

  // ===== 认证支撑（仅供 auth 域 provider 消费，对应约定）：iam 域身份存取的唯一跨域出口 =====

  /** 按用户名取认证凭据视图（含 passwordHash 敏感列）；auth.provider 校验凭据用。 */
  findAuthByUsername(username: string): Promise<UserCredentialView | null> {
    return this.users.findCredentialByUsername(username);
  }

  /** username 唯一性预检（本地注册查重）。 */
  existsByUsername(username: string): Promise<boolean> {
    return this.users.existsByUsername(username);
  }

  /** email 唯一性预检（本地注册查重）。 */
  existsByEmail(email: string): Promise<boolean> {
    return this.users.existsByEmail(email);
  }

  /** 本地注册建号（无角色绑定，对应约定：注册用户无角色无权限）。 */
  create(props: {
    username: string;
    name: string;
    email: string | null;
    passwordHash: string;
  }): Promise<UserCredentialView> {
    return this.users.create(props);
  }

  private async mustFindById(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotFoundException({
        code: ERROR_CODE.user.notFound,
        message: '用户不存在',
      });
    }
    return user;
  }

  private async mustFindViewById(userId: string): Promise<UserView> {
    const view = await this.users.findViewById(userId);
    if (!view) {
      throw new NotFoundException({
        code: ERROR_CODE.user.notFound,
        message: '用户不存在',
      });
    }
    return view;
  }
}
