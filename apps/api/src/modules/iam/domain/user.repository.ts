import type { TableQueryRequest } from '@cip/shared';
import type { User, UserStatus } from './user.entity';

/** 注入令牌：模块内以 useClass 绑定 infrastructure 实现（application 不 import infrastructure）。 */
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

/** 用户管理列表读模型（CQRS-lite）：不含 passwordHash 等敏感列，时间为 ISO 8601 字符串。 */
export interface UserView {
  /** 稳定标识，用于记录关联与定位。 */
  id: string;
  /** 登录账号名，用于认证与唯一性校验。 */
  username: string;
  /** 供管理界面展示的名称。 */
  name: string;
  /** 联系邮箱；未提供时为空。 */
  email: string | null;
  /** 当前业务状态，用于展示和后续操作判定。 */
  status: UserStatus;
  /** 账号绑定的角色标识全集。 */
  roleIds: string[];
  /** 创建时间的 ISO 8601 表示。 */
  createdAt: string;
}

/** 角色绑定读行：形状对齐本域 `PermissionSet.fromRoles` 入参，展开语义单源。 */
export interface UserRoleBindingRow {
  /** 账号绑定的角色及其权限投影。 */
  role: {
    /** 业务标识，用于目录匹配或错误识别。 */
    code: string;
    /** 角色关联的权限点投影。 */
    permissions: Array<{
      /** 权限点标识及同步状态。 */
      permissionPoint: {
        /** 业务标识，用于目录匹配或错误识别。 */
        code: string;
        /** 目录同步状态，用于排除已废弃项。 */
        state: string;
      };
    }>;
  };
}

/** 认证凭据读模型：含 passwordHash 敏感列，仅供 auth 域 provider 校验凭据，禁止出认证链路。 */
export interface UserCredentialView {
  /** 稳定标识，用于记录关联与定位。 */
  id: string;
  /** 登录账号名，用于认证与唯一性校验。 */
  username: string;
  /** 供管理界面展示的名称。 */
  name: string;
  /** 联系邮箱；未提供时为空。 */
  email: string | null;
  /** 当前业务状态，用于展示和后续操作判定。 */
  status: UserStatus;
  /** 仅供认证校验的密码哈希，禁止进入公开响应。 */
  passwordHash: string | null;
}

/**
 * 用户聚合持久化端口；实现见 infrastructure。
 * 事务封装在实现内部，事务句柄不进接口签名。
 */
export interface UserRepository {
  /** 命令路径：装载聚合（含角色绑定）；不存在返回 null。 */
  findById(id: string): Promise<User | null>;
  /**
   * 查询路径：表格结构化查询（POST /users/query 语义）。
   * 入参为已校验的规范请求（shared TableQueryRequest；字段白名单在 DTO 与实现双重落实），
   * 多列排序后追加唯一 ID tie-break；items/total 使用相同筛选条件。
   */
  queryTable(query: TableQueryRequest): Promise<{
    items: UserView[];
    total: number;
  }>;
  /** 查询路径：变更后回读视图。 */
  findViewById(id: string): Promise<UserView | null>;
  /** 仅落状态列。 */
  saveStatus(user: User): Promise<void>;
  /** 事务内全量替换角色绑定（deleteMany + createMany 原子）。 */
  replaceRoles(user: User): Promise<void>;
  /** /me 权限展开的绑定读行（含角色与权限点关联）。 */
  findRoleBindings(userId: string): Promise<UserRoleBindingRow[]>;
  /** 查询路径：按用户名取认证凭据视图（含 passwordHash；仅认证域消费）。 */
  findCredentialByUsername(
    username: string,
  ): Promise<UserCredentialView | null>;
  /** 查询路径：username 唯一性预检（本地注册查重）。 */
  existsByUsername(username: string): Promise<boolean>;
  /** 查询路径：email 唯一性预检（本地注册查重）。 */
  existsByEmail(email: string): Promise<boolean>;
  /** 命令路径：本地注册建号（无角色绑定，对应约定：注册用户无角色无权限），返回凭据视图。 */
  create(props: {
    username: string;
    name: string;
    email: string | null;
    passwordHash: string;
  }): Promise<UserCredentialView>;
}
