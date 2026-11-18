import { describe, expect, it } from 'vitest';
import { mergeNavigation, type NavigationOverrideRow } from '../merge';
import { NAVIGATION_CATALOG } from '../nodes';

const NO_OVERRIDES: NavigationOverrideRow[] = [];
const FULL_PERMISSIONS = ['*'];

function override(
  code: string,
  patch: Partial<Omit<NavigationOverrideRow, 'code'>>,
): NavigationOverrideRow {
  return { code, title: null, icon: null, sort: null, visible: true, ...patch };
}

describe('mergeNavigation', () => {
  it('无覆盖时输出目录默认树，权限点为空的节点登录即可见', () => {
    const tree = mergeNavigation(NO_OVERRIDES, []);
    const codes = tree.map((node) => node.code);
    expect(codes).toContain('workspace');
    // admin 域的子项全部需要权限点，无权限时子项被裁、整域隐藏
    expect(codes).not.toContain('admin');
  });

  it('覆盖列生效：title 与 sort 覆盖，null 回退目录默认', () => {
    const tree = mergeNavigation(
      [override('workspace', { title: '首页', sort: 50 })],
      FULL_PERMISSIONS,
    );
    const workspace = tree.find((node) => node.code === 'workspace');
    expect(workspace?.title).toBe('首页');
    expect(workspace?.sort).toBe(50);
    expect(workspace?.icon).toBe('layout-dashboard');
  });

  it('visible=false 隐藏节点', () => {
    const tree = mergeNavigation(
      [override('workspace', { visible: false })],
      FULL_PERMISSIONS,
    );
    expect(tree.find((node) => node.code === 'workspace')).toBeUndefined();
  });

  it('按权限点过滤子节点；子项全部被裁时整域隐藏', () => {
    const tree = mergeNavigation(NO_OVERRIDES, ['role:manage']);
    const admin = tree.find((node) => node.code === 'admin');
    expect(admin).toBeDefined();
    expect(admin?.children.map((child) => child.code)).toEqual([
      'admin.roles',
      'admin.permission-points',
    ]);

    const none = mergeNavigation(NO_OVERRIDES, []);
    expect(none.find((node) => node.code === 'admin')).toBeUndefined();
  });

  it('非法图标键回退目录默认图标', () => {
    const tree = mergeNavigation(
      [override('workspace', { icon: 'not-an-icon' })],
      FULL_PERMISSIONS,
    );
    expect(tree.find((node) => node.code === 'workspace')?.icon).toBe(
      'layout-dashboard',
    );
  });

  it('各层按 sort 升序排列', () => {
    const tree = mergeNavigation(
      [
        override('admin.menus', { sort: 1 }),
        override('admin.users', { sort: 99 }),
      ],
      FULL_PERMISSIONS,
    );
    const admin = tree.find((node) => node.code === 'admin');
    const children = admin?.children ?? [];
    const sorts = children.map((child) => child.sort);
    expect(sorts).toEqual([...sorts].sort((left, right) => left - right));
    expect(children[0]?.code).toBe('admin.menus');
    expect(children.at(-1)?.code).toBe('model-gateway.usages');
  });

  it('目录条目 code 唯一', () => {
    const codes = NAVIGATION_CATALOG.map((def) => def.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
