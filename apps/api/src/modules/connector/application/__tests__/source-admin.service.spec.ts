import { describe, expect, it } from 'vitest';
import type { SourceType } from '../../domain/source-adapter.port';
import { SourceInstance } from '../../domain/source-instance.entity';
import type { SourceInstanceRepository } from '../../domain/source-instance.repository';
import { SourceAdminService } from '../source-admin.service';
import type { SourceRegistry } from '../source-registry.service';

const AT = new Date('2026-11-16T00:00:00.000Z');
const LATER = new Date('2026-11-16T01:00:00.000Z');

class FakeSourceInstanceRepository implements SourceInstanceRepository {
  constructor(private readonly instance: SourceInstance | null) {}
  async findById(id: string): Promise<SourceInstance | null> {
    return this.instance?.id === id ? this.instance : null;
  }
  async findByTypeAndName(
    _sourceType: SourceType,
    name: string,
  ): Promise<SourceInstance | null> {
    return this.instance?.name === name ? this.instance : null;
  }
  async list(): Promise<SourceInstance[]> {
    return this.instance ? [this.instance] : [];
  }
  async save(): Promise<void> {}
}

function makeInstance(): SourceInstance {
  return SourceInstance.create({
    id: 'instance-1',
    sourceType: 'lark',
    name: '研发群',
    config: {},
    now: AT,
  });
}

class FakeSourceRegistry {
  get(): {
    validateConfig: (config: unknown) => unknown;
  } {
    return {
      validateConfig: (config: unknown) => {
        if (!config || typeof config !== 'object')
          throw new Error('来源配置不能为空');
        return config;
      },
    };
  }
}

function makeService(instance: SourceInstance | null): SourceAdminService {
  return new SourceAdminService(
    new FakeSourceInstanceRepository(instance),
    new FakeSourceRegistry() as unknown as SourceRegistry,
  );
}

describe('SourceAdminService', () => {
  it('列出来源实例', async () => {
    const service = makeService(makeInstance());
    expect(await service.list()).toHaveLength(1);
  });

  it('停用与启用', async () => {
    const instance = makeInstance();
    const service = makeService(instance);
    const disabled = await service.setEnabled('instance-1', false, LATER);
    expect(disabled.isEnabled).toBe(false);
    const enabled = await service.setEnabled('instance-1', true, LATER);
    expect(enabled.isEnabled).toBe(true);
  });

  it('创建时先校验配置', async () => {
    const service = makeService(null);
    const created = await service.create({
      sourceType: 'lark',
      name: '研发群',
      config: { chats: ['chat-1'] },
    });
    expect(created.name).toBe('研发群');
  });

  it('配置无效时拒绝创建', async () => {
    const service = makeService(null);
    await expect(
      service.create({
        sourceType: 'lark',
        name: '研发群',
        config: null,
      }),
    ).rejects.toThrow('来源配置不能为空');
  });

  it('修改名称与配置', async () => {
    const instance = makeInstance();
    const service = makeService(instance);
    const updated = await service.update(
      'instance-1',
      { name: '新群', config: { chats: ['chat-2'] } },
      LATER,
    );
    expect(updated.name).toBe('新群');
    expect(updated.config).toEqual({ chats: ['chat-2'] });
    expect(updated.updatedAt).toEqual(LATER);
  });

  it('修改时配置无效被拒绝', async () => {
    const service = makeService(makeInstance());
    await expect(
      service.update('instance-1', { config: null }),
    ).rejects.toThrow('来源配置不能为空');
  });

  it('实例不存在时报错', async () => {
    const service = makeService(null);
    await expect(service.setEnabled('missing', false)).rejects.toThrow(
      '来源实例不存在',
    );
  });
});
