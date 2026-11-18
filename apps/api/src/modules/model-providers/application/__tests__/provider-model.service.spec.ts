import { describe, expect, it } from 'vitest';
import { makeImportFixture } from './fixtures/model-import.fixture';

describe('完整目录导入用例', () => {
  it('去重、跳过已有项、保留部分成功，失败不泄漏内部错误', async () => {
    const { service, saved } = makeImportFixture();
    const result = await service.createImport('p', {
      catalogProviderId: 'catalog',
      modelIds: ['existing', 'new', 'new', 'failed', 'unknown'],
    });
    expect(result).toMatchObject({ created: 1, skipped: 1, failed: 2 });
    expect(saved).toEqual(['new']);
    expect(result.items.find((item) => item.modelId === 'failed')?.error).toBe(
      '模型注册失败，请重试',
    );
    expect(
      result.items.find((item) => item.modelId === 'unknown')?.status,
    ).toBe('failed');
    expect(
      await service.createImport('p', {
        catalogProviderId: 'catalog',
        modelIds: ['new'],
      }),
    ).toMatchObject({ created: 0, skipped: 1, failed: 0 });
  });
  it('目录不存在时在任何写入前失败', async () => {
    const { service, saved } = makeImportFixture();
    await expect(
      service.createImport('p', {
        catalogProviderId: 'missing',
        modelIds: ['new'],
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(saved).toEqual([]);
  });
});
