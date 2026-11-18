import { describe, expect, it } from 'vitest';
import { Decision } from '../decision.entity';

const AT = new Date('2026-11-16T00:00:00.000Z');

const base = {
  id: 'decision-1',
  threadId: 'thread-1',
  kind: 'accept' as const,
  strength: 'explicit' as const,
  scope: { projectKey: 'project-a' },
  matchedRuleIds: ['rule-1'],
  policyId: 'policy-1',
  policyVersion: 7,
  reason: '信息完整，可开工',
  triggerIds: ['trigger-1', 'trigger-2'],
  now: AT,
};

describe('Decision 聚合', () => {
  it('accept 结论标记为接单', () => {
    const decision = Decision.create(base);
    expect(decision.isAccepted).toBe(true);
    expect(decision.triggerIds).toEqual(['trigger-1', 'trigger-2']);
  });

  it('非 accept 不接单', () => {
    const decision = Decision.create({ ...base, kind: 'ignore' });
    expect(decision.isAccepted).toBe(false);
  });

  it('必须关联事件批次', () => {
    expect(() => Decision.create({ ...base, triggerIds: [] })).toThrow(
      '结论必须关联事件批次',
    );
  });

  it('策略版本必须为正整数', () => {
    expect(() => Decision.create({ ...base, policyVersion: 0 })).toThrow(
      '策略版本必须为正整数',
    );
  });

  it('必须带依据（reason 或 matchedRuleIds）', () => {
    expect(() =>
      Decision.create({ ...base, reason: null, matchedRuleIds: null }),
    ).toThrow('结论必须带依据');
  });

  it('快照可重建等价聚合', () => {
    const decision = Decision.create(base);
    const restored = Decision.rehydrate(decision.toSnapshot());
    expect(restored.toSnapshot()).toEqual(decision.toSnapshot());
  });
});
