import type { TableQueryRequest } from '@cip/shared';
import { ERROR_CODE, PERMISSION_CATALOG } from '@cip/shared';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DomainError } from '../domain/domain.error';
import {
  PERMISSION_POINT_REPOSITORY,
  type PermissionPointRepository,
} from '../domain/permission-point.repository';
import { Role } from '../domain/role.entity';
import {
  ROLE_REPOSITORY,
  type RoleRepository,
  type RoleView,
} from '../domain/role.repository';

/** 角色管理服务（应用层）：角色 CRUD 与权限点授予关系；内置角色不变量经实体守卫。 */
@Injectable()
export class RoleService {
  constructor(
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
    @Inject(PERMISSION_POINT_REPOSITORY)
    private readonly permissionPoints: PermissionPointRepository,
  ) {}

  /** 角色表格查询（POST /roles/query 用例）：规范请求透传仓储。 */
  async queryTable(query: TableQueryRequest): Promise<{
    items: RoleView[];
    total: number;
  }> {
    return this.roles.queryTable(query);
  }

  async getDetail(id: string): Promise<RoleView> {
    const view = await this.roles.findViewById(id);
    if (!view) {
      throw new NotFoundException({
        code: ERROR_CODE.role.notFound,
        message: '角色不存在',
      });
    }
    return view;
  }

  async create(input: {
    code: string;
    name: string;
    description: string | null;
  }): Promise<RoleView> {
    const codeTaken = await this.roles.findByCode(input.code);
    if (codeTaken) {
      throw new ConflictException({
        code: ERROR_CODE.request.invalid,
        message: `角色标识 ${input.code} 已存在`,
      });
    }
    return this.roles.create(Role.register(input));
  }

  async update(
    id: string,
    input: { name: string; description: string | null },
  ): Promise<RoleView> {
    const role = await this.mustFindById(id);
    role.rename(input.name, input.description);
    await this.roles.save(role, 'basic');
    return this.getDetail(id);
  }

  /**
   * 全量替换角色 × 权限点授予关系；后台角色编辑页的保存动作。
   * @throws 角色不存在 404；内置角色 409；存在未知权限点 404。
   */
  async setPermissionPoints(
    id: string,
    permissionCodes: string[],
  ): Promise<RoleView> {
    const uniqueCodes = [...new Set(permissionCodes)];
    const role = await this.mustFindById(id);
    try {
      role.ensureMutable();
    } catch (cause) {
      throw this.toHttpException(cause);
    }
    const activeCodes =
      await this.permissionPoints.findActiveCodes(uniqueCodes);
    if (activeCodes.length !== uniqueCodes.length) {
      throw new NotFoundException({
        code: ERROR_CODE.role.unknownPermission,
        message: '存在未知或已废弃的权限点',
      });
    }
    role.grantPermissions(uniqueCodes);
    await this.roles.save(role, 'permissions');
    return this.getDetail(id);
  }

  /**
   * 删除角色；绑定中的用户随级联解除（UserRole 外键约束）。
   * @throws 角色不存在 404；内置角色 409。
   */
  async remove(id: string): Promise<void> {
    const role = await this.mustFindById(id);
    try {
      role.ensureDeletable();
    } catch (cause) {
      throw this.toHttpException(cause);
    }
    await this.roles.remove(id);
  }

  /** 权限点目录清单（注册校验用）：新建角色表单的可选项来源。 */
  get catalogCodes(): string[] {
    return PERMISSION_CATALOG.map((def) => def.code);
  }

  private async mustFindById(id: string): Promise<Role> {
    const role = await this.roles.findById(id);
    if (!role) {
      throw new NotFoundException({
        code: ERROR_CODE.role.notFound,
        message: '角色不存在',
      });
    }
    return role;
  }

  /** 领域不变量违反 → HTTP 语义：当前仅有内置角色保护（409）。 */
  private toHttpException(cause: unknown): unknown {
    if (cause instanceof DomainError) {
      return new ConflictException({
        code: cause.code,
        message: cause.message,
      });
    }
    return cause;
  }
}
