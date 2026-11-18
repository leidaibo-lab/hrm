import { describe, expect, it } from 'vitest';
import { Subscription } from '../subscription.entity';

const AT = new Date('2026-11-16T00:00:00.000Z');

const base = {
  ticketId: 'ticket-1',
  threadId: 'thread-1',
  reason: 'started' as const,
  now: AT,
};

describe('Subscription 聚合', () => {
  it('创建后记录工单、线程与原因', () => {
    const subscription = Subscription.create(base);
    expect(subscription.ticketId).toBe('ticket-1');
    expect(subscription.threadId).toBe('thread-1');
    expect(subscription.reason).toBe('started');
    expect(subscription.createdAt).toEqual(AT);
  });

  it('工单不能为空', () => {
    expect(() => Subscription.create({ ...base, ticketId: '  ' })).toThrow(
      '订阅工单不能为空',
    );
  });

  it('线程不能为空', () => {
    expect(() => Subscription.create({ ...base, threadId: '  ' })).toThrow(
      '订阅线程不能为空',
    );
  });

  it('快照可重建等价聚合', () => {
    const subscription = Subscription.create(base);
    const restored = Subscription.rehydrate(subscription.toSnapshot());
    expect(restored.toSnapshot()).toEqual(subscription.toSnapshot());
  });
});
