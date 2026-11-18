import { describe, expect, it } from 'vitest';
import { SourceInstance } from '../source-instance.entity';

const AT = new Date('2026-11-16T00:00:00.000Z');

const base = {
  id: 'instance-1',
  sourceType: 'lark' as const,
  name: '研发群',
  config: { chats: ['chat-1'] },
  botId: 'bot-1',
  now: AT,
};

describe('SourceInstance 聚合', () => {
  it('创建后默认启用', () => {
    const instance = SourceInstance.create(base);
    expect(instance.isEnabled).toBe(true);
    expect(instance.botId).toBe('bot-1');
  });

  it('名称不能为空', () => {
    expect(() => SourceInstance.create({ ...base, name: '  ' })).toThrow(
      '来源实例名称不能为空',
    );
  });

  it('配置不能为空', () => {
    expect(() => SourceInstance.create({ ...base, config: null })).toThrow(
      '来源配置不能为空',
    );
  });

  it('启停幂等并更新时间', () => {
    const instance = SourceInstance.create(base);
    const later = new Date('2026-11-16T01:00:00.000Z');
    instance.disable(later);
    instance.disable(later);
    expect(instance.isEnabled).toBe(false);
    expect(instance.updatedAt).toEqual(later);
  });

  it('快照可重建等价聚合', () => {
    const instance = SourceInstance.create(base);
    const restored = SourceInstance.rehydrate(instance.toSnapshot());
    expect(restored.toSnapshot()).toEqual(instance.toSnapshot());
  });
});
