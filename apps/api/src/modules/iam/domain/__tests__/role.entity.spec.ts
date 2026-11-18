import { ERROR_CODE } from '@cip/shared';
import { describe, expect, it } from 'vitest';
import { DomainError } from '../domain.error';
import { Role } from '../role.entity';

describe('Role（内置角色保护不变量）', () => {
  it('register 产出非内置、无权限点的新角色', () => {
    const role = Role.register({
      code: 'ops',
      name: '运维',
      description: null,
    });
    expect(role.code).toBe('ops');
    expect(role.permissionCodes).toEqual([]);
    // 非内置：两个守卫都放行
    expect(() => role.ensureMutable()).not.toThrow();
    expect(() => role.ensureDeletable()).not.toThrow();
  });

  it('内置角色 ensureMutable / ensureDeletable 抛 DomainError（code 单源于 ERROR_CODE）', () => {
    const role = Role.reconstitute({
      id: 'r1',
      code: 'super-admin',
      name: '超级管理员',
      description: null,
      isBuiltin: true,
      permissionCodes: ['*'],
    });
    expect(() => role.ensureMutable()).toThrow(DomainError);
    expect(() => role.ensureDeletable()).toThrow(DomainError);
    try {
      role.ensureMutable();
    } catch (cause) {
      expect((cause as DomainError).code).toBe(
        ERROR_CODE.role.builtinProtected,
      );
      expect((cause as DomainError).message).toBe('内置角色不可修改权限');
    }
  });

  it('grantPermissions 全量替换并去重', () => {
    const role = Role.register({
      code: 'ops',
      name: '运维',
      description: null,
    });
    role.grantPermissions(['user:manage', 'role:manage', 'user:manage']);
    expect(role.permissionCodes).toEqual(['user:manage', 'role:manage']);
  });

  it('内置角色 grantPermissions 抛错且状态不被改动', () => {
    const role = Role.reconstitute({
      id: 'r1',
      code: 'super-admin',
      name: '超级管理员',
      description: null,
      isBuiltin: true,
      permissionCodes: ['role:manage'],
    });
    expect(() => role.grantPermissions(['user:manage'])).toThrow(DomainError);
    expect(role.permissionCodes).toEqual(['role:manage']);
  });

  it('rename 更新名称与描述', () => {
    const role = Role.register({
      code: 'ops',
      name: '旧名',
      description: null,
    });
    role.rename('新名', '新描述');
    expect(role.name).toBe('新名');
    expect(role.description).toBe('新描述');
  });

  it('reconstitute 对 permissionCodes 做防御性拷贝', () => {
    const source = ['user:manage'];
    const role = Role.reconstitute({
      id: 'r1',
      code: 'ops',
      name: '运维',
      description: null,
      isBuiltin: false,
      permissionCodes: source,
    });
    source.push('role:manage');
    expect(role.permissionCodes).toEqual(['user:manage']);
  });
});
