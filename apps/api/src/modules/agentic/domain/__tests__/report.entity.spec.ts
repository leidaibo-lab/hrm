import { describe, expect, it } from 'vitest';
import { Report } from '../report.entity';

const AT = new Date('2026-11-16T00:00:00.000Z');

const base = {
  id: 'report-1',
  assignmentId: 'assignment-1',
  kind: 'progress' as const,
  payload: { percent: 40 },
  now: AT,
};

describe('Report 聚合', () => {
  it('创建后记录派发与负载', () => {
    const report = Report.create(base);
    expect(report.assignmentId).toBe('assignment-1');
    expect(report.payload).toEqual({ percent: 40 });
    expect(report.createdAt).toEqual(AT);
  });

  it('派发不能为空', () => {
    expect(() => Report.create({ ...base, assignmentId: '  ' })).toThrow(
      '回报派发不能为空',
    );
  });

  it('负载不能为空', () => {
    expect(() => Report.create({ ...base, payload: null })).toThrow(
      '回报负载不能为空',
    );
  });

  it('快照可重建等价聚合', () => {
    const report = Report.create(base);
    const restored = Report.rehydrate(report.toSnapshot());
    expect(restored.toSnapshot()).toEqual(report.toSnapshot());
  });
});
