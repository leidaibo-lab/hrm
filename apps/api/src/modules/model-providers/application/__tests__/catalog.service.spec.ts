import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type {
  CatalogPort,
  CatalogProviderView,
} from '../../domain/catalog.port';
import { CatalogService } from '../catalog.service';

const provider: CatalogProviderView = {
  providerId: 'openai',
  name: 'OpenAI',
  baseUrl: null,
  models: [],
};

function makeService(
  fetchCatalog: CatalogPort['fetchCatalog'],
): CatalogService {
  return new CatalogService({ fetchCatalog });
}

describe('CatalogService', () => {
  it('返回目录数据（读模型映射为 DTO）', async () => {
    const service = makeService(async () => [provider]);
    await expect(service.list()).resolves.toEqual([provider]);
    await expect(service.get('openai')).resolves.toEqual(provider);
  });

  it('目录中不存在该服务商时 404', async () => {
    const service = makeService(async () => [provider]);
    await expect(service.get('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('上游失败翻译为 503 model.catalog_unavailable', async () => {
    const service = makeService(async () => {
      throw new Error('upstream down');
    });
    const error = await service.list().catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getResponse()).toMatchObject({
      code: 'model.catalog_unavailable',
    });
  });
});
