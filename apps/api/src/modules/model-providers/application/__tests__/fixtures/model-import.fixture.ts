import { ModelProvider } from '../../../domain/model-provider.entity';
import type { ProviderRepository } from '../../../domain/model-provider.repository';
import type { ModelRegistrationPort } from '../../../domain/model-registration.port';
import type { ProviderModelRepository } from '../../../domain/provider-model.repository';
import { CatalogService } from '../../catalog.service';
import { ProviderModelService } from '../../provider-model.service';

/** 导入用例边界替身：只保留已存在记录和本次成功写入结果。 */
export function makeImportFixture() {
  const saved: string[] = [];
  const providers = {
    findById: async () =>
      ModelProvider.reconstitute({
        id: 'p',
        slug: 'provider',
        name: '供应商',
        baseUrl: 'https://example.invalid',
        apiKeyCipher: 'test',
        timeoutMs: null,
        rateLimitPerMinute: null,
        maxConcurrent: null,
        enabled: true,
      }),
  } as unknown as ProviderRepository;
  const models = {
    existsByProviderModel: async (_providerId: string, id: string) =>
      id === 'existing' || saved.includes(id),
    existsByLogicalKey: async () => false,
  } as unknown as ProviderModelRepository;
  const catalog = new CatalogService({
    fetchCatalog: async () => [
      {
        providerId: 'catalog',
        name: '目录',
        baseUrl: null,
        models: ['existing', 'new', 'failed'].map((modelId) => ({
          modelId,
          displayName: modelId,
          reasoning: false,
          toolCall: true,
          structuredOutput: true,
          imageInput: false,
          contextWindow: null,
          maxOutputTokens: null,
          input: 1,
          output: 2,
          cacheRead: null,
          cacheWrite: null,
        })),
      },
    ],
  });
  const registration: ModelRegistrationPort = {
    create: async (model) => {
      if (model.modelId === 'failed') throw new Error('内部错误不向用户泄漏');
      saved.push(model.modelId);
      return 'created';
    },
  };
  return {
    saved,
    service: new ProviderModelService(models, providers, registration, catalog),
  };
}
