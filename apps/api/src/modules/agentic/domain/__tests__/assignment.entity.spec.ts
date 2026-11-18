import { describe, expect, it } from 'vitest';
import { Assignment } from '../assignment.entity';

const AT = new Date('2026-11-16T00:00:00.000Z');
const LATER = new Date('2026-11-16T01:00:00.000Z');

function createAssignment(): Assignment {
  return Assignment.create({
    id: 'assignment-1',
    ticketId: 'ticket-1',
    attempt: 2,
    now: AT,
  });
}

describe('Assignment 聚合', () => {
  it('创建后为待执行', () => {
    const assignment = createAssignment();
    expect(assignment.status).toBe('pending');
    expect(assignment.attempt).toBe(2);
  });

  it('开始执行记录运行标识', () => {
    const assignment = createAssignment();
    assignment.start('run-1', LATER);
    expect(assignment.status).toBe('running');
    expect(assignment.executorRunId).toBe('run-1');
    expect(assignment.startedAt).toEqual(LATER);
  });

  it('同一运行重复开始幂等', () => {
    const assignment = createAssignment();
    assignment.start('run-1', LATER);
    assignment.start('run-1', LATER);
    expect(assignment.executorRunId).toBe('run-1');
  });

  it('其他运行不能抢占', () => {
    const assignment = createAssignment();
    assignment.start('run-1', LATER);
    expect(() => assignment.start('run-2', LATER)).toThrow(
      '派发已在其他运行中执行',
    );
  });

  it('结束后不能再开始，重复结束幂等', () => {
    const assignment = createAssignment();
    assignment.start('run-1', AT);
    assignment.end(LATER, 'timeout');
    assignment.end(LATER, 'another');
    expect(assignment.isEnded).toBe(true);
    expect(assignment.error).toBe('timeout');
    expect(() => assignment.start('run-2', LATER)).toThrow(
      '派发已结束，不能重新开始',
    );
  });

  it('快照可重建等价聚合', () => {
    const assignment = createAssignment();
    assignment.start('run-1', AT);
    assignment.end(LATER);
    const restored = Assignment.rehydrate(assignment.toSnapshot());
    expect(restored.toSnapshot()).toEqual(assignment.toSnapshot());
  });
});
