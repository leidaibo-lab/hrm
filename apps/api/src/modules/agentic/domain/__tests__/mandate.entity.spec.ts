import { describe, expect, it } from 'vitest';
import { Mandate } from '../mandate.entity';

const AT = new Date('2026-11-16T00:00:00.000Z');

const base = {
  id: 'mandate-1',
  policyId: 'policy-1',
  policyVersion: 7,
  strength: 'explicit' as const,
  scope: { projectKey: 'project-a', kinds: ['requirement'] },
  actorId: 'open-id-1',
  actorUserId: 'user-1',
  sourceType: 'lark',
  matchedRules: ['rule-1'],
  now: AT,
};

describe('Mandate 聚合', () => {
  it('创建后记录范围与策略版本', () => {
    const mandate = Mandate.create(base);
    expect(mandate.policyVersion).toBe(7);
    expect(mandate.scope).toEqual(base.scope);
    expect(mandate.createdAt).toEqual(AT);
  });

  it('策略版本必须为正整数', () => {
    expect(() => Mandate.create({ ...base, policyVersion: 0 })).toThrow(
      '策略版本必须为正整数',
    );
  });

  it('发起人不能为空', () => {
    expect(() => Mandate.create({ ...base, actorId: '  ' })).toThrow(
      '授权发起人不能为空',
    );
  });

  it('授权范围不能为空', () => {
    expect(() => Mandate.create({ ...base, scope: null })).toThrow(
      '授权范围不能为空',
    );
  });

  it('快照可重建等价聚合', () => {
    const mandate = Mandate.create(base);
    const restored = Mandate.rehydrate(mandate.toSnapshot());
    expect(restored.toSnapshot()).toEqual(mandate.toSnapshot());
  });
});
