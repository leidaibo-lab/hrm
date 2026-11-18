import type { TableQueryRequest } from '@cip/shared';
import type { Role } from './role.entity';

/** 注入令牌：模块内以 useClass 绑定 infrastructure 实现。 */
export const ROLE_REPOSITORY = Symbol('ROLE_REPOSITORY');

/** 角色管理读模型（后台视图）：含生效的权限点 code 集合，时间为 ISO 8601 字符串。 */
export interface RoleView {
  /** 稳定标识，用于记录关联与定位。 */
  id: string;
  /** 业务标识，用于目录匹配或错误识别。 */
  code: string;
  /** 供管理界面展示的名称。 */
  name: string;
  /** 供界面展示的补充说明。 */
  description: string | null;
  /** 是否为内置角色，决定管理操作限制。 */
  isBuiltin: boolean;
  /** 当前角色授予的权限点标识全集。 */
  permissionCodes: string[];
  /** 创建时间的 ISO 8601 表示。 */
  createdAt: string;
}

/** 角色聚合持久化端口；实现见 infrastructure，事务封装在实现内部。 */
export interface RoleRepository {
  /**
   * 查询路径：表格结构化查询（POST /roles/query 语义）。
   * 入参为已校验的规范请求；多列排序后追加唯一 ID tie-break；items/total 同条件。
   */
  queryTable(query: TableQueryRequest): Promise<{
    items: RoleView[];
    total: number;
  }>;
  /** 查询路径：变更后回读视图。 */
  findViewById(id: string): Promise<RoleView | null>;
  /** 命令路径：装载聚合（含权限点绑定）；不存在返回 null。 */
  findById(id: string): Promise<Role | null>;
  /** code 唯一性校验用。 */
  findByCode(code: string): Promise<Role | null>;
  /** 存在性批量校验（用户绑角色前）；仅返回存在的 id。 */
  findExistingIds(ids: string[]): Promise<string[]>;
  /** 新建标量列（权限点绑定为空），返回创建后的读模型。 */
  create(role: Role): Promise<RoleView>;
  /** 按修改意图更新基本信息或事务内替换权限绑定。 */
  save(role: Role, scope?: 'basic' | 'permissions'): Promise<void>;
  /** 删除角色；绑定中的用户随级联解除（UserRole 外键约束）。 */
  remove(id: string): Promise<void>;
}
