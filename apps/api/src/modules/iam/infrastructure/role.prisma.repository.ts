import type { TableQueryRequest } from '@cip/shared';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma';
import type { Prisma } from '../../../platform/prisma/generated/client';
import {
  buildTableOrderBy,
  buildTableWhere,
  tablePageArgs,
} from '../../../platform/table-query';
import type { Role } from '../domain/role.entity';
import type { RoleRepository, RoleView } from '../domain/role.repository';
import { toRoleDomain } from './role.mapper';

/** RoleRepository 的 Prisma 实现：取存细节与事务封装全部收口在此。 */
@Injectable()
export class RolePrismaRepository implements RoleRepository {
  /** 展示字段 → 存储列绑定：isBuiltin 以 builtin/custom 枚举投影。 */
  private static readonly bindings = {
    code: { type: 'column', column: 'code' },
    name: { type: 'column', column: 'name' },
    isBuiltin: {
      type: 'boolean',
      column: 'isBuiltin',
      truthy: 'builtin',
      falsy: 'custom',
    },
    createdAt: { type: 'column', column: 'createdAt' },
  } as const;

  private static readonly qColumns = ['code', 'name', 'description'] as const;

  constructor(private readonly prisma: PrismaService) {}

  async queryTable(query: TableQueryRequest): Promise<{
    items: RoleView[];
    total: number;
  }> {
    const where: Prisma.RoleWhereInput = buildTableWhere(
      query,
      RolePrismaRepository.bindings,
      null,
      RolePrismaRepository.qColumns,
    ) as Prisma.RoleWhereInput;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.role.findMany({
        where,
        include: { permissions: { select: { permissionCode: true } } },
        orderBy: buildTableOrderBy(
          query,
          RolePrismaRepository.bindings,
        ) as Prisma.RoleOrderByWithRelationInput[],
        ...tablePageArgs(query),
      }),
      this.prisma.role.count({ where }),
    ]);
    return { total, items: rows.map((row) => this.toView(row)) };
  }

  async findViewById(id: string): Promise<RoleView | null> {
    const row = await this.prisma.role.findUnique({
      where: { id },
      include: { permissions: { select: { permissionCode: true } } },
    });
    return row ? this.toView(row) : null;
  }

  async findById(id: string): Promise<Role | null> {
    const row = await this.prisma.role.findUnique({
      where: { id },
      include: { permissions: { select: { permissionCode: true } } },
    });
    return row ? toRoleDomain(row) : null;
  }

  async findByCode(code: string): Promise<Role | null> {
    const row = await this.prisma.role.findUnique({ where: { code } });
    return row ? toRoleDomain({ ...row, permissions: [] }) : null;
  }

  async findExistingIds(ids: string[]): Promise<string[]> {
    const rows = await this.prisma.role.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async create(role: Role): Promise<RoleView> {
    const row = await this.prisma.role.create({
      data: {
        code: role.code,
        name: role.name,
        description: role.description,
      },
      include: { permissions: { select: { permissionCode: true } } },
    });
    return this.toView(row);
  }

  async save(
    role: Role,
    scope: 'basic' | 'permissions' = 'basic',
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      if (scope === 'basic') {
        await tx.role.update({
          where: { id: role.id },
          data: { name: role.name, description: role.description },
        });
      }
      if (scope === 'permissions') {
        await tx.rolePermissionPoint.deleteMany({ where: { roleId: role.id } });
        await tx.rolePermissionPoint.createMany({
          data: role.permissionCodes.map((permissionCode) => ({
            roleId: role.id,
            permissionCode,
          })),
        });
      }
    });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.role.delete({ where: { id } });
  }

  private toView(row: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    isBuiltin: boolean;
    permissions: Array<{ permissionCode: string }>;
    createdAt: Date;
  }): RoleView {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      isBuiltin: row.isBuiltin,
      permissionCodes: row.permissions.map((grant) => grant.permissionCode),
      createdAt: row.createdAt.toISOString(),
    };
  }
}
