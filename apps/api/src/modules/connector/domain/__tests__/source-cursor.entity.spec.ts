import { describe, expect, it } from 'vitest';
import { SourceCursor } from '../source-cursor.entity';

const AT = new Date('2026-11-16T00:00:00.000Z');

describe('SourceCursor 聚合', () => {
  it('创建后记录实例与游标', () => {
    const cursor = SourceCursor.create({
      instanceId: 'instance-1',
      cursor: { updatedAt: '2026-11-16T00:00:00.000Z' },
      now: AT,
    });
    expect(cursor.instanceId).toBe('instance-1');
    expect(cursor.updatedAt).toEqual(AT);
  });

  it('游标不能为空', () => {
    expect(() =>
      SourceCursor.create({ instanceId: 'instance-1', cursor: null }),
    ).toThrow('游标不能为空');
  });

  it('快照可重建等价聚合', () => {
    const cursor = SourceCursor.create({
      instanceId: 'instance-1',
      cursor: { page: 3 },
      now: AT,
    });
    const restored = SourceCursor.rehydrate(cursor.toSnapshot());
    expect(restored.toSnapshot()).toEqual(cursor.toSnapshot());
  });
});
