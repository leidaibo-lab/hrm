import { describe, expect, it } from 'vitest';
import { TriggerAlreadyDisposedError } from '../domain.error';
import { Trigger } from '../trigger.entity';

const AT = new Date('2026-11-16T00:00:00.000Z');

function createTrigger(): Trigger {
  return Trigger.create({
    id: 'trigger-1',
    dedupeKey: 'lark:message-1',
    sourceType: 'lark',
    instanceId: 'instance-1',
    threadId: 'thread-1',
    scopeKey: 'project-a',
    actorId: 'open-id-1',
    text: '这个需求需要补充验收标准',
    payload: { messageId: 'message-1' },
    occurredAt: AT,
    receivedAt: AT,
  });
}

describe('Trigger 聚合', () => {
  it('创建后为 pending 且无处置时间', () => {
    const trigger = createTrigger();
    expect(trigger.isPending).toBe(true);
    expect(trigger.disposition).toBe('pending');
    expect(trigger.disposedAt).toBeNull();
  });

  it('只能从 pending 迁移一次', () => {
    const trigger = createTrigger();
    trigger.markEvaluated(AT);
    expect(trigger.disposition).toBe('evaluated');
    expect(trigger.disposedAt).toEqual(AT);
    expect(() => trigger.markFiltered(AT)).toThrow(TriggerAlreadyDisposedError);
  });

  it('三种终态都可从 pending 到达', () => {
    for (const mark of [
      'markFiltered',
      'markEvaluated',
      'markFannedOut',
    ] as const) {
      const trigger = createTrigger();
      trigger[mark](AT);
      expect(trigger.isPending).toBe(false);
    }
  });

  it('快照可重建等价聚合', () => {
    const trigger = createTrigger();
    trigger.markFannedOut(AT);
    const restored = Trigger.rehydrate(trigger.toSnapshot());
    expect(restored.toSnapshot()).toEqual(trigger.toSnapshot());
  });
});

describe('Trigger 过滤原因', () => {
  it('过滤时保留判定原因并随快照重建', () => {
    const trigger = Trigger.create({
      id: 'trigger-filter',
      dedupeKey: 'lark:filter',
      sourceType: 'lark',
      instanceId: 'instance-1',
      threadId: 'thread-1',
      actorId: 'actor-1',
      text: '无关消息',
      payload: {},
      occurredAt: AT,
    });

    trigger.markFiltered(AT, 'denied');

    expect(trigger.filterReason).toBe('denied');
    expect(Trigger.rehydrate(trigger.toSnapshot()).filterReason).toBe('denied');
  });
});
