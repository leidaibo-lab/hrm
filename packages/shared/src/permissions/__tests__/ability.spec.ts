import { describe, expect, it } from 'vitest';
import { buildAbility, PERMISSION, PERMISSION_CATALOG } from '../index';

describe('buildAbility', () => {
  it('通配权限点获得全量能力', () => {
    const ability = buildAbility(['*']);
    expect(ability.can('manage', 'all')).toBe(true);
    expect(ability.can('read', 'user')).toBe(true);
  });

  it('权限点拆分为 action + subject', () => {
    const ability = buildAbility([PERMISSION.user.manage.code]);
    expect(ability.can('manage', 'user')).toBe(true);
    expect(ability.can('read', 'role')).toBe(false);
  });

  it('kebab 资源段权限点按目录 resource 段注册与判定', () => {
    const ability = buildAbility([PERMISSION.modelProvider.manage.code]);
    expect(ability.can('manage', 'model-provider')).toBe(true);
    expect(ability.can('manage', 'permission-point')).toBe(false);
  });

  it('空集合默认全禁', () => {
    const ability = buildAbility([]);
    expect(ability.can('read', 'user')).toBe(false);
    expect(ability.can('manage', 'all')).toBe(false);
  });

  it('非法权限点抛出', () => {
    expect(() => buildAbility(['nocolon'])).toThrow();
    expect(() => buildAbility([':leading'])).toThrow();
    expect(() => buildAbility(['trailing:'])).toThrow();
  });

  it('目录外但形态合法的权限点抛出（受控数据校验）', () => {
    expect(() => buildAbility(['fake-resource:read'])).toThrow();
  });

  it('目录条目 code 均为 resource:action 两段式且可被 buildAbility 消化', () => {
    for (const def of PERMISSION_CATALOG) {
      // ADR-0081：domain.resource:action，domain 与 resource 以点分隔。
      expect(def.code).toMatch(/^[a-z][a-z.-]*:[a-z]+$/);
      expect(() => buildAbility([def.code])).not.toThrow();
    }
  });
});
