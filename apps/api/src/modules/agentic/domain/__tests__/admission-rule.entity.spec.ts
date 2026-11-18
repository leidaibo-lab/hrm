import { describe, expect, it } from 'vitest';
import { AdmissionRule } from '../admission-rule.entity';

const AT = new Date('2026-11-16T00:00:00.000Z');

const base = {
  id: 'rule-1',
  policyId: 'policy-1',
  sourceInstanceId: 'instance-1',
  scopeRow: 'project-a',
  cell: 'listed_unaddressed' as const,
  allowed: true,
  now: AT,
};

describe('AdmissionRule 聚合', () => {
  it('创建后记录单元格与判定', () => {
    const rule = AdmissionRule.create(base);
    expect(rule.cell).toBe('listed_unaddressed');
    expect(rule.allowed).toBe(true);
  });

  it('范围行不能为空', () => {
    expect(() => AdmissionRule.create({ ...base, scopeRow: '  ' })).toThrow(
      '准入范围不能为空',
    );
  });

  it('源实例不能为空', () => {
    expect(() =>
      AdmissionRule.create({ ...base, sourceInstanceId: '  ' }),
    ).toThrow('源实例不能为空');
  });

  it('三种单元格都可创建', () => {
    for (const cell of [
      'listed_unaddressed',
      'unlisted_addressed',
      'unlisted_unaddressed',
    ] as const) {
      const rule = AdmissionRule.create({ ...base, cell });
      expect(rule.cell).toBe(cell);
    }
  });

  it('快照可重建等价聚合', () => {
    const rule = AdmissionRule.create(base);
    const restored = AdmissionRule.rehydrate(rule.toSnapshot());
    expect(restored.toSnapshot()).toEqual(rule.toSnapshot());
  });
});
