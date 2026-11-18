import type { TableQueryRequest } from '@cip/shared';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma';
import type { Prisma } from '../../../platform/prisma/generated/client';
import {
  buildTableOrderBy,
  buildTableWhere,
  tablePageArgs,
} from '../../../platform/table-query';
import type { User, UserStatus } from '../domain/user.entity';
import type {
  UserCredentialView,
  UserRepository,
  UserRoleBindingRow,
  UserView,
} from '../domain/user.repository';
import { toUserDomain } from './user.mapper';

/** UserRepository 的 Prisma 实现：取存细节与事务封装全部收口在此。 */
@Injectable()
export class UserPrismaRepository implements UserRepository {
  /** 展示字段 → 存储列绑定（安全白名单：未声明字段在组装层 fail-fast）。 */
  private static readonly bindings = {
    username: { type: 'column', column: 'username' },
    name: { type: 'column', column: 'name' },
    email: { type: 'column', column: 'email', nullable: true },
    status: { type: 'column', column: 'status' },
    createdAt: { type: 'column', column: 'createdAt' },
  } as const;

  /** q 跨字段搜索列（含不在筛选白名单内的列）。 */
  private static readonly qColumns = ['name', 'username', 'email'] as const;

  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: { select: { roleId: true } } },
    });
    return row ? toUserDomain(row) : null;
  }

  async queryTable(query: TableQueryRequest): Promise<{
    items: UserView[];
    total: number;
  }> {
    const where: Prisma.UserWhereInput = buildTableWhere(
      query,
      UserPrismaRepository.bindings,
      null,
      UserPrismaRepository.qColumns,
    ) as Prisma.UserWhereInput;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: { roles: { select: { roleId: true } } },
        orderBy: buildTableOrderBy(
          query,
          UserPrismaRepository.bindings,
        ) as Prisma.UserOrderByWithRelationInput[],
        ...tablePageArgs(query),
      }),
      this.prisma.user.count({ where }),
    ]);
    return { total, items: rows.map((row) => this.toView(row)) };
  }

  async findViewById(id: string): Promise<UserView | null> {
    const row = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: { select: { roleId: true } } },
    });
    return row ? this.toView(row) : null;
  }

  async saveStatus(user: User): Promise<void> {
    await this.prisma.user.update({
      where: { id: user.id },
      data: { status: user.status },
    });
  }

  async replaceRoles(user: User): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId: user.id } }),
      this.prisma.userRole.createMany({
        data: user.roleIds.map((roleId) => ({ userId: user.id, roleId })),
      }),
    ]);
  }

  async findRoleBindings(userId: string): Promise<UserRoleBindingRow[]> {
    const bindings = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: { permissions: { include: { permissionPoint: true } } },
        },
      },
    });
    return bindings.map((binding) => ({
      role: {
        code: binding.role.code,
        permissions: binding.role.permissions.map((grant) => ({
          permissionPoint: {
            code: grant.permissionPoint.code,
            state: grant.permissionPoint.state,
          },
        })),
      },
    }));
  }

  async findCredentialByUsername(
    username: string,
  ): Promise<UserCredentialView | null> {
    const row = await this.prisma.user.findUnique({ where: { username } });
    return row ? this.toCredential(row) : null;
  }

  async existsByUsername(username: string): Promise<boolean> {
    const count = await this.prisma.user.count({ where: { username } });
    return count > 0;
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.prisma.user.count({ where: { email } });
    return count > 0;
  }

  async create(props: {
    username: string;
    name: string;
    email: string | null;
    passwordHash: string;
  }): Promise<UserCredentialView> {
    const row = await this.prisma.user.create({ data: { ...props } });
    return this.toCredential(row);
  }

  /** 认证凭据映射：含敏感列，仅供认证链路。 */
  private toCredential(row: {
    id: string;
    username: string;
    name: string;
    email: string | null;
    status: UserStatus;
    passwordHash: string | null;
  }): UserCredentialView {
    return {
      id: row.id,
      username: row.username,
      name: row.name,
      email: row.email,
      status: row.status,
      passwordHash: row.passwordHash,
    };
  }

  private toView(row: {
    id: string;
    username: string;
    name: string;
    email: string | null;
    status: UserStatus;
    roles: Array<{ roleId: string }>;
    createdAt: Date;
  }): UserView {
    return {
      id: row.id,
      username: row.username,
      name: row.name,
      email: row.email,
      status: row.status,
      roleIds: row.roles.map((binding) => binding.roleId),
      createdAt: row.createdAt.toISOString(),
    };
  }
}
