import type { TableQueryRequest } from '@cip/shared';
import {
  buildAbility,
  ERROR_CODE,
  FilterOperator,
  PERMISSION,
  SortDirection,
} from '@cip/shared';
import { NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { RoleView } from '../../domain/role.repository';
import type {
  UserRoleBindingRow,
  UserView,
} from '../../domain/user.repository';
import { userQueryBodySchema, usersQueryDef } from '../../dto/user.dto';
import { UserService } from '../user.service';
import {
  FakeRoleRepository,
  FakeUserRepository,
  makeRoleRow,
  makeUserRow,
} from './fixtures/fake-repositories.fixture';

function makeService(
  userRows: UserView[] = [],
  roleRows: RoleView[] = [makeRoleRow({ id: 'r1' }), makeRoleRow({ id: 'r2' })],
) {
  const users = new FakeUserRepository(userRows);
  const roles = new FakeRoleRepository(roleRows);
  return { users, roles, service: new UserService(users, roles) };
}

/** 表格查询请求工厂：默认空条件，用例只声明差异。 */
function makeQuery(
  overrides: Partial<TableQueryRequest> = {},
): TableQueryRequest {
  return {
    page: 1,
    pageSize: 20,
    q: null,
    scope: null,
    filters: [],
    sort: [],
    ...overrides,
  };
}

async function httpError(run: () => Promise<unknown>) {
  return (await run().catch((cause) => cause)) as {
    getResponse(): Record<string, unknown>;
  };
}

describe('UserService（应用层）', () => {
  it('setStatus 启停经实体落库并返回视图', async () => {
    const { users, service } = makeService([makeUserRow({ id: 'u1' })]);
    const view = await service.setStatus('u1', 'suspended');
    expect(view.status).toBe('suspended');
    expect(users.rows[0].status).toBe('suspended');
  });

  it('setStatus 用户不存在 404（对齐 JSDoc 既定语义）', async () => {
    const { service } = makeService([]);
    const error = await httpError(() =>
      service.setStatus('ghost', 'suspended'),
    );
    expect(error).toBeInstanceOf(NotFoundException);
    expect(error.getResponse()).toMatchObject({
      code: ERROR_CODE.user.notFound,
    });
  });

  it('setRoles 存在无效角色 404 且绑定不变', async () => {
    const { users, service } = makeService([
      makeUserRow({ id: 'u1', roleIds: ['r1'] }),
    ]);
    const error = await httpError(() =>
      service.setRoles('u1', ['r1', 'ghost']),
    );
    expect(error).toBeInstanceOf(NotFoundException);
    expect(error.getResponse()).toMatchObject({
      code: ERROR_CODE.role.notFound,
      message: '存在无效角色',
    });
    expect(users.rows[0].roleIds).toEqual(['r1']);
  });

  it('setRoles 全量替换并去重', async () => {
    const { users, service } = makeService([
      makeUserRow({ id: 'u1', roleIds: ['r1'] }),
    ]);
    const view = await service.setRoles('u1', ['r2', 'r2']);
    expect(view.roleIds).toEqual(['r2']);
    expect(users.rows[0].roleIds).toEqual(['r2']);
  });

  it('queryTable 返回分页读模型与总数', async () => {
    const rows = [
      makeUserRow({ id: 'u1', createdAt: '2026-11-02T00:00:03.000Z' }),
      makeUserRow({ id: 'u2', createdAt: '2026-11-02T00:00:01.000Z' }),
      makeUserRow({ id: 'u3', createdAt: '2026-11-02T00:00:02.000Z' }),
    ];
    const { service } = makeService(rows);
    const page = await service.queryTable(
      makeQuery({
        pageSize: 2,
        sort: [{ field: 'createdAt', direction: SortDirection.Asc }],
      }),
    );
    expect(page.total).toBe(3);
    expect(page.items.map((item) => item.id)).toEqual(['u2', 'u3']);
  });

  it('query 契约：白名单外字段与非法方向被拒（DTO 校验）', () => {
    expect(
      userQueryBodySchema.safeParse({
        filters: [
          { field: 'passwordHash', operator: FilterOperator.Equal, value: 'x' },
        ],
      }).success,
    ).toBe(false);
    expect(
      userQueryBodySchema.safeParse({
        sort: [{ field: 'createdAt', direction: 'down' }],
      }).success,
    ).toBe(false);
    expect(
      userQueryBodySchema.safeParse({
        filters: [{ field: 'name', operator: 'contains', value: 'a' }],
      }).success,
    ).toBe(true);
    // 定义即白名单：排序/筛选字段集合一致
    expect(Object.keys(usersQueryDef.fields)).toContain('createdAt');
  });

  it('queryTable 透传多列排序并保持字段顺序', async () => {
    const rows = [
      makeUserRow({ id: 'u1', name: 'b', status: 'active' }),
      makeUserRow({ id: 'u2', name: 'a', status: 'active' }),
      makeUserRow({ id: 'u3', name: 'a', status: 'suspended' }),
    ];
    const { service } = makeService(rows);
    const result = await service.queryTable(
      makeQuery({
        sort: [
          { field: 'name', direction: SortDirection.Asc },
          { field: 'status', direction: SortDirection.Desc },
        ],
      }),
    );
    // name asc 平局时 status desc 决出次序，再以 id tie-break 稳定
    expect(result.items.map((item) => item.id)).toEqual(['u3', 'u2', 'u1']);
  });

  it('queryTable 过滤后分页 total 与筛选条件一致', async () => {
    const rows = [
      makeUserRow({ id: 'u1', name: '张三' }),
      makeUserRow({ id: 'u2', name: '张四' }),
      makeUserRow({ id: 'u3', name: '李五' }),
    ];
    const { service } = makeService(rows);
    const result = await service.queryTable(
      makeQuery({
        q: '张',
        filters: [
          {
            kind: 'text',
            field: 'name',
            operator: FilterOperator.NotContains,
            value: '四',
          },
        ],
        pageSize: 1,
      }),
    );
    expect(result.total).toBe(1);
    expect(result.items.map((item) => item.id)).toEqual(['u1']);
  });

  it('findAuthByUsername 返回含 passwordHash 的凭据视图；未注入凭据为 null', async () => {
    const { users, service } = makeService([makeUserRow({ id: 'u1' })]);
    users.setCredential('u1', 'argon2-hash');
    const view = await service.findAuthByUsername('user-u1');
    expect(view).toMatchObject({
      id: 'u1',
      username: 'user-u1',
      status: 'active',
      passwordHash: 'argon2-hash',
    });
    expect(await service.findAuthByUsername('ghost')).toBeNull();
  });

  it('create 本地建号：无角色绑定且凭据可读回', async () => {
    const { users, service } = makeService();
    const view = await service.create({
      username: 'newcomer',
      name: '新用户',
      email: null,
      passwordHash: 'argon2-hash',
    });
    expect(view.username).toBe('newcomer');
    expect(users.rows).toHaveLength(1);
    expect(users.rows[0].roleIds).toEqual([]);
    expect((await service.findAuthByUsername('newcomer'))?.passwordHash).toBe(
      'argon2-hash',
    );
  });

  it('existsByUsername/existsByEmail 唯一性预检', async () => {
    const { service } = makeService([makeUserRow({ id: 'u1', email: 'a@x' })]);
    expect(await service.existsByUsername('user-u1')).toBe(true);
    expect(await service.existsByUsername('ghost')).toBe(false);
    expect(await service.existsByEmail('a@x')).toBe(true);
    expect(await service.existsByEmail('ghost@x')).toBe(false);
  });
});

describe('UserService 会话权限生效（AUT-9.1）', () => {
  /** 绑定行工厂：只声明用例关心的角色与权限点。 */
  function binding(
    code: string,
    points: Array<{ code: string; state: 'active' | 'deprecated' }>,
  ): UserRoleBindingRow {
    return {
      role: {
        code,
        permissions: points.map((point) => ({ permissionPoint: point })),
      },
    };
  }

  it('撤销角色后，下一次会话解析立即失去对应权限（无需重新登录）', async () => {
    const { users, service } = makeService([makeUserRow({ id: 'u1' })]);
    users.setRoleBindings('u1', [
      binding('role-a', [
        { code: PERMISSION.user.manage.code, state: 'active' },
      ]),
    ]);
    const before = await service.findSessionUser('u1');
    expect(before?.permissions).toEqual([PERMISSION.user.manage.code]);
    expect(buildAbility(before?.permissions ?? []).can('manage', 'user')).toBe(
      true,
    );

    users.setRoleBindings('u1', []);
    const after = await service.findSessionUser('u1');
    expect(after?.permissions).toEqual([]);
    expect(buildAbility(after?.permissions ?? []).can('manage', 'user')).toBe(
      false,
    );
  });

  it('deprecated 权限点不进入会话权限（目录废弃即失效）', async () => {
    const { users, service } = makeService([makeUserRow({ id: 'u1' })]);
    users.setRoleBindings('u1', [
      binding('role-a', [
        { code: PERMISSION.role.manage.code, state: 'active' },
        { code: PERMISSION.user.manage.code, state: 'deprecated' },
      ]),
    ]);
    const view = await service.findSessionUser('u1');
    expect(view?.permissions).toEqual([PERMISSION.role.manage.code]);
  });

  it('super-admin 角色短路为通配权限 [*]', async () => {
    const { users, service } = makeService([makeUserRow({ id: 'u1' })]);
    users.setRoleBindings('u1', [binding('super-admin', [])]);
    const view = await service.findSessionUser('u1');
    expect(view?.permissions).toEqual(['*']);
  });

  it('挂起用户下一次会话解析返回 null（下一请求统一 401）', async () => {
    const { users, service } = makeService([makeUserRow({ id: 'u1' })]);
    users.setRoleBindings('u1', [
      binding('role-a', [
        { code: PERMISSION.user.manage.code, state: 'active' },
      ]),
    ]);
    expect(await service.findSessionUser('u1')).not.toBeNull();
    users.rows[0].status = 'suspended';
    expect(await service.findSessionUser('u1')).toBeNull();
  });

  it('用户不存在返回 null 而不是抛错', async () => {
    const { service } = makeService([]);
    expect(await service.findSessionUser('ghost')).toBeNull();
  });
});
