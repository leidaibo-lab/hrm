import type { ModelCapabilities } from '@cip/shared';
import { describe, expect, it } from 'vitest';
import type { CatalogPort, CatalogProvider } from '../../domain/catalog.port';
import type {
  CatalogSyncCreateData,
  CatalogSyncRecord,
  CatalogSyncRepository,
} from '../../domain/catalog.repository';
import type {
  CandidateWithProvider,
  ModelRepository,
} from '../../domain/model.repository';
import type {
  CatalogPriceData,
  PriceRecord,
  PriceRepository,
} from '../../domain/price.repository';
import { CatalogService } from '../catalog.service';

const capabilities: ModelCapabilities = {
  contextWindow: 128_000,
  maxOutputTokens: 8_192,
  toolCall: true,
  imageInput: false,
  audioInput: false,
  structuredOutput: true,
  reasoning: false,
  embedding: false,
  streaming: true,
};

function candidate(
  overrides: Partial<CandidateWithProvider>,
): CandidateWithProvider {
  return {
    id: 'candidate-1',
    logicalModelId: 'logical-1',
    providerId: 'provider-1',
    providerModelId: 'gpt-4o',
    catalogModelId: 'gpt-4o',
    priority: 1,
    enabled: true,
    timeoutMs: null,
    capabilities,
    defaultParams: null,
    createdAt: new Date(0),
    providerSlug: 'openai',
    providerEnabled: true,
    providerHealth: 'healthy',
    providerOpenUntil: null,
    providerCatalogProviderId: 'openai',
    ...overrides,
  };
}

const catalogProvider: CatalogProvider = {
  providerId: 'openai',
  name: 'OpenAI',
  models: [
    {
      modelId: 'gpt-4o',
      displayName: 'GPT-4o',
      reasoning: false,
      toolCall: true,
      structuredOutput: true,
      imageInput: true,
      contextWindow: 128_000,
      maxOutputTokens: 8_192,
      input: 2.5,
      output: 10,
      cacheRead: 1.25,
      cacheWrite: null,
      reasoningPrice: null,
    },
  ],
};

function priceRecord(data: CatalogPriceData): PriceRecord {
  return {
    id: 'price-1',
    candidateId: data.candidateId,
    source: 'models_dev',
    currency: data.currency,
    input: data.input,
    output: data.output,
    cacheRead: data.cacheRead,
    cacheWrite: data.cacheWrite,
    reasoning: data.reasoning,
    effectiveFrom: data.fetchedAt,
    fetchedAt: data.fetchedAt,
    createdAt: data.fetchedAt,
  };
}

describe('CatalogService.sync', () => {
  it('匹配候选写入目录价，未匹配计数并标记 partial', async () => {
    const writes: CatalogPriceData[] = [];
    const records: CatalogSyncCreateData[] = [];
    const service = new CatalogService(
      { fetchCatalog: async () => [catalogProvider] } as CatalogPort,
      {
        create: async (data: CatalogSyncCreateData) => {
          records.push(data);
          return syncRecord(data);
        },
        list: async () => [],
      } as CatalogSyncRepository,
      {
        listCandidatesWithProvider: async () => [
          candidate({ id: 'matched' }),
          candidate({ id: 'unmatched', catalogModelId: 'missing' }),
        ],
      } as unknown as ModelRepository,
      {
        recordCatalog: async (data: CatalogPriceData) => {
          writes.push(data);
          return priceRecord(data);
        },
      } as unknown as PriceRepository,
      {
        get: async () => ({
          providers: new Map(),
          logicalByKey: new Map(),
          candidatesByLogical: new Map(),
        }),
        invalidate: () => undefined,
      },
    );

    const result = await service.sync();

    expect(result.status).toBe('partial');
    expect(result.pricesWritten).toBe(1);
    expect(result.unmatched).toBe(1);
    expect(result.providers).toBe(1);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      candidateId: 'matched',
      currency: 'USD',
      input: '2.5',
      output: '10',
      cacheRead: '1.25',
      cacheWrite: null,
    });
    expect(records).toHaveLength(1);
  });

  it('费率未变时跳过写入，仍记录 success', async () => {
    const service = new CatalogService(
      { fetchCatalog: async () => [catalogProvider] } as CatalogPort,
      {
        create: async (data: CatalogSyncCreateData) => syncRecord(data),
        list: async () => [],
      } as CatalogSyncRepository,
      {
        listCandidatesWithProvider: async () => [candidate({})],
      } as unknown as ModelRepository,
      { recordCatalog: async () => null } as unknown as PriceRepository,
      {
        get: async () => ({
          providers: new Map(),
          logicalByKey: new Map(),
          candidatesByLogical: new Map(),
        }),
        invalidate: () => undefined,
      },
    );

    const result = await service.sync();

    expect(result.status).toBe('success');
    expect(result.pricesWritten).toBe(0);
    expect(result.unmatched).toBe(0);
  });
});

function syncRecord(data: CatalogSyncCreateData): CatalogSyncRecord {
  return {
    id: 'sync-1',
    startedAt: data.startedAt.toISOString(),
    finishedAt: data.finishedAt.toISOString(),
    status: data.status,
    providers: data.providers,
    models: data.models,
    pricesWritten: data.pricesWritten,
    unmatched: data.unmatched,
    error: data.error,
    createdAt: data.finishedAt.toISOString(),
  };
}
