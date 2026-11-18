import { describe, expect, it } from 'vitest';
import { Effect } from '../effect.entity';

const AT = new Date('2026-11-16T00:00:00.000Z');

function createEffect(): Effect {
  return Effect.create({
    id: 'effect-1',
    idempotencyKey: 'issue:thread-1:1',
    kind: 'create_issue',
    target: 'gitlab:project-a',
    now: AT,
  });
}

describe('Effect 聚合', () => {
  it('创建后为待执行', () => {
    const effect = createEffect();
    expect(effect.status).toBe('pending');
    expect(effect.completedAt).toBeNull();
  });

  it('成功后记录结果', () => {
    const effect = createEffect();
    effect.succeed({ issueId: 42 }, AT);
    expect(effect.isSucceeded).toBe(true);
    expect(effect.result).toEqual({ issueId: 42 });
  });

  it('失败后可重试回到 pending', () => {
    const effect = createEffect();
    effect.fail({ message: 'timeout' }, AT);
    expect(effect.status).toBe('failed');
    effect.retry();
    expect(effect.status).toBe('pending');
    expect(effect.completedAt).toBeNull();
  });

  it('成功后不能重试或再次成功', () => {
    const effect = createEffect();
    effect.succeed({}, AT);
    expect(() => effect.retry()).toThrow('不能重试');
    expect(() => effect.succeed({}, AT)).toThrow('不能标记成功');
  });

  it('永久失败后不能重试', () => {
    const effect = createEffect();
    effect.markGone({ message: 'project deleted' }, AT);
    expect(() => effect.retry()).toThrow('不能重试');
  });

  it('快照可重建等价聚合', () => {
    const effect = createEffect();
    effect.succeed({ issueId: 42 }, AT);
    const restored = Effect.rehydrate(effect.toSnapshot());
    expect(restored.toSnapshot()).toEqual(effect.toSnapshot());
  });
});
