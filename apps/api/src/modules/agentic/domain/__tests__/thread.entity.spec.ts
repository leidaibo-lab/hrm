import { describe, expect, it } from 'vitest';
import { ThreadClosedError } from '../domain.error';
import { Thread } from '../thread.entity';

const AT = new Date('2026-11-16T00:00:00.000Z');
const LATER = new Date('2026-11-16T01:00:00.000Z');

function openThread(): Thread {
  return Thread.open({
    id: 't-1',
    sourceType: 'lark',
    externalKey: 'lark:chat:root',
    scopeKey: 'project-a',
    now: AT,
  });
}

describe('Thread 聚合', () => {
  it('开启后为 open，摘要为空且版本为 0', () => {
    const thread = openThread();
    expect(thread.status).toBe('open');
    expect(thread.summary).toBeNull();
    expect(thread.summaryVersion).toBe(0);
    expect(thread.isOpen).toBe(true);
  });

  it('事件时间只前进不后退', () => {
    const thread = openThread();
    thread.touch(LATER);
    thread.touch(AT);
    expect(thread.lastEventAt).toEqual(LATER);
  });

  it('应用摘要时版本自增并去空白', () => {
    const thread = openThread();
    thread.applySummary('  需求背景  ', LATER);
    expect(thread.summary).toBe('需求背景');
    expect(thread.summaryVersion).toBe(1);
  });

  it('空摘要被拒绝', () => {
    const thread = openThread();
    expect(() => thread.applySummary('   ', LATER)).toThrow('摘要不能为空');
  });

  it('关闭后拒绝事件与摘要更新', () => {
    const thread = openThread();
    thread.close(LATER);
    expect(thread.isOpen).toBe(false);
    expect(() => thread.touch(LATER)).toThrow(ThreadClosedError);
    expect(() => thread.applySummary('再次更新', LATER)).toThrow(
      ThreadClosedError,
    );
  });

  it('快照可重建等价的聚合', () => {
    const thread = openThread();
    thread.applySummary('摘要', LATER);
    const restored = Thread.rehydrate(thread.toSnapshot());
    expect(restored.toSnapshot()).toEqual(thread.toSnapshot());
  });
});
