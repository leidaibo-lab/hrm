import { describe, expect, it } from 'vitest';
import { PermissionSet } from '../permission-set.entity';

describe('PermissionSet', () => {
  it('super-admin 短路为通配', () => {
    const roles = [
      {
        code: 'super-admin',
        permissions: [
          { permissionPoint: { code: 'user:manage', state: 'active' } },
        ],
      },
      { code: 'other', permissions: [] },
    ];
    expect(PermissionSet.fromRoles(roles).codes).toEqual(['*']);
  });

  it('普通角色展开为去重后的 active 权限点', () => {
    const roles = [
      {
        code: 'a',
        permissions: [
          { permissionPoint: { code: 'user:manage', state: 'active' } },
          { permissionPoint: { code: 'role:manage', state: 'active' } },
          { permissionPoint: { code: 'role:manage', state: 'active' } },
        ],
      },
      {
        code: 'b',
        permissions: [
          { permissionPoint: { code: 'role:manage', state: 'active' } },
          {
            permissionPoint: { code: 'navigation:manage', state: 'deprecated' },
          },
        ],
      },
    ];
    expect(PermissionSet.fromRoles(roles).codes).toEqual([
      'user:manage',
      'role:manage',
    ]);
  });

  it('无角色为空集合', () => {
    expect(PermissionSet.fromRoles([]).codes).toEqual([]);
  });
});
