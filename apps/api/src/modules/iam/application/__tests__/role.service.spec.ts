import type { TableQueryRequest } from '@cip/shared';
import { ERROR_CODE, FilterOperator, SortDirection } from '@cip/shared';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { RoleView } from '../../domain/role.repository';
import { RoleService } from '../role.service';
import {
  FakePermissionPointRepository,
  FakeRoleRepository,
  makeRoleRow,
} from './fixtures/fake-repositories.fixture';

/** 表格查询请求工厂：默认默认排序（真实链路由 planTableQuery 落位），用例只声明差异。 */
function makeQuery(
  overrides: Partial<TableQueryRequest> = {},
): TableQueryRequest {
  return {
    page: 1,
    pageSize: 20,
    q: null,
    scope: null,
    filters: [],
    sort: [{ field: 'createdAt', direction: SortDirection.Asc }],
    ...overrides,
  };
}

function makeService(rows: RoleView[] = []) {
  const roles = new FakeRoleRepository(rows);
  const points = new FakePermissionPointRepository([
    {
      code: 'user:manage',
      resource: 'user',
      action: 'manage',
      summary: null,
      state: 'active',
    },
    {
      code: 'role:manage',
      resource: 'role',
      action: 'manage',
      summary: null,
      state: 'active',
    },
    {
      code: 'role:read',
      resource: 'role',
      action: 'read',
      summary: null,
      state: 'deprecated',
    },
  ]);
  return { roles, points, service: new RoleService(roles, points) };
}

async function httpError(run: () => Promise<unknown>) {
  return (await run().catch((cause) => cause)) as {
    getResponse(): Record<string, unknown>;
  };
}

describe('RoleService（应用层）', () => {
  it('setPermissionPoints 内置角色 409（code/message 与既有契约一致），仓储不被写入', async () => {
    const { roles, service } = makeService([
      makeRoleRow({
        id: 'builtin',
        isBuiltin: true,
        permissionCodes: ['role:manage'],
      }),
    ]);
    const error = await httpError(() =>
      service.setPermissionPoints('builtin', ['user:manage']),
    );
    expect(error).toBeInstanceOf(ConflictException);
    expect(error.getResponse()).toMatchObject({
      code: ERROR_CODE.role.builtinProtected,
      message: '内置角色不可修改权限',
    });
    expect(roles.rows[0].permissionCodes).toEqual(['role:manage']);
  });

  it('setPermissionPoints 存在未知或已废弃权限点 404', async () => {
    const { roles, service } = makeService([makeRoleRow({ id: 'r1' })]);
    // 'ghost' 不存在；'role:read' 已 deprecated——两者都不算 active
    const error = await httpError(() =>
      service.setPermissionPoints('r1', ['user:manage', 'role:read', 'ghost']),
    );
    expect(error).toBeInstanceOf(NotFoundException);
    expect(error.getResponse()).toMatchObject({
      code: ERROR_CODE.role.unknownPermission,
    });
    expect(roles.rows[0].permissionCodes).toEqual([]);
  });

  it('setPermissionPoints 正常路径全量替换并去重，返回最新视图', async () => {
    const { service } = makeService([makeRoleRow({ id: 'r1' })]);
    const view = await service.setPermissionPoints('r1', [
      'user:manage',
      'user:manage',
      'role:manage',
    ]);
    expect(view.permissionCodes).toEqual(['user:manage', 'role:manage']);
  });

  it('remove 内置角色 409；不存在 404', async () => {
    const builtin = makeService([
      makeRoleRow({ id: 'builtin', isBuiltin: true }),
    ]);
    const error409 = await httpError(() => builtin.service.remove('builtin'));
    expect(error409).toBeInstanceOf(ConflictException);
    expect(error409.getResponse()).toMatchObject({
      code: ERROR_CODE.role.builtinProtected,
      message: '内置角色不可删除',
    });

    const missing = makeService([]);
    const error404 = await httpError(() => missing.service.remove('ghost'));
    expect(error404).toBeInstanceOf(NotFoundException);
    expect(error404.getResponse()).toMatchObject({
      code: ERROR_CODE.role.notFound,
    });
  });

  it('create 角色标识已存在 409；成功时返回无权限点的新视图', async () => {
    const { roles, service } = makeService([
      makeRoleRow({ id: 'r1', code: 'ops' }),
    ]);
    const conflict = await httpError(() =>
      service.create({ code: 'ops', name: '重名', description: null }),
    );
    expect(conflict).toBeInstanceOf(ConflictException);
    expect(conflict.getResponse()).toMatchObject({
      code: ERROR_CODE.request.invalid,
    });

    const view = await service.create({
      code: 'audit',
      name: '审计',
      description: null,
    });
    expect(view.permissionCodes).toEqual([]);
    expect(roles.rows).toHaveLength(2);
  });

  it('update 与 getDetail：不存在 404，存在则更新并返回', async () => {
    const { roles, service } = makeService([
      makeRoleRow({ id: 'r1', name: '旧名' }),
    ]);
    const missing = await httpError(() =>
      service.update('ghost', { name: 'x', description: null }),
    );
    expect(missing).toBeInstanceOf(NotFoundException);

    const view = await service.update('r1', {
      name: '新名',
      description: '描述',
    });
    expect(view.name).toBe('新名');
    expect(roles.rows[0].name).toBe('新名');
  });

  it('queryTable 透传多列排序并保持字段顺序', async () => {
    const { service } = makeService([
      makeRoleRow({ id: 'r1', code: 'c-b' }),
      makeRoleRow({ id: 'r2', code: 'c-a' }),
      makeRoleRow({ id: 'r3', code: 'c-c' }),
    ]);
    const asc = await service.queryTable(
      makeQuery({ sort: [{ field: 'code', direction: SortDirection.Asc }] }),
    );
    expect(asc.items.map((row) => row.id)).toEqual(['r2', 'r1', 'r3']);
    const desc = await service.queryTable(
      makeQuery({ sort: [{ field: 'code', direction: SortDirection.Desc }] }),
    );
    expect(desc.items.map((row) => row.id)).toEqual(['r3', 'r1', 'r2']);
  });

  it('queryTable isBuiltin 以 builtin/custom 枚举投影筛选', async () => {
    const { service } = makeService([
      makeRoleRow({ id: 'r1', isBuiltin: true }),
      makeRoleRow({ id: 'r2', isBuiltin: false }),
    ]);
    const builtin = await service.queryTable(
      makeQuery({
        filters: [
          {
            kind: 'enum',
            field: 'isBuiltin',
            operator: FilterOperator.Equal,
            values: ['builtin'],
          },
        ],
      }),
    );
    expect(builtin.items.map((row) => row.id)).toEqual(['r1']);
    const custom = await service.queryTable(
      makeQuery({
        filters: [
          {
            kind: 'enum',
            field: 'isBuiltin',
            operator: FilterOperator.NotEqual,
            values: ['builtin'],
          },
        ],
      }),
    );
    expect(custom.items.map((row) => row.id)).toEqual(['r2']);
  });
});
