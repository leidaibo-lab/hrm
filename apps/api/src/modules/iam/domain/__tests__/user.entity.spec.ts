import { describe, expect, it } from 'vitest';
import { User } from '../user.entity';

describe('User（启停与角色绑定）', () => {
  it('changeStatus 切换启停状态', () => {
    const user = User.reconstitute('u1', 'active', []);
    user.changeStatus('suspended');
    expect(user.status).toBe('suspended');
    user.changeStatus('active');
    expect(user.status).toBe('active');
  });

  it('replaceRoles 全量替换并去重', () => {
    const user = User.reconstitute('u1', 'active', ['r1']);
    user.replaceRoles(['r2', 'r3', 'r2']);
    expect(user.roleIds).toEqual(['r2', 'r3']);
  });

  it('reconstitute 对 roleIds 做防御性拷贝', () => {
    const source = ['r1'];
    const user = User.reconstitute('u1', 'active', source);
    source.push('r2');
    expect(user.roleIds).toEqual(['r1']);
  });
});
