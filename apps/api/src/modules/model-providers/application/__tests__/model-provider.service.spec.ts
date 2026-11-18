import type { TableQueryRequest } from '@cip/shared';
import { SortDirection } from '@cip/shared';
import { describe, expect, it } from 'vitest';
import { CryptoService } from '../../../../platform/crypto';
import type { ModelProvider } from '../../domain/model-provider.entity';
import type {
  ProviderRepository,
  ProviderView,
} from '../../domain/model-provider.repository';
import { ModelProviderService } from '../model-provider.service';

function makeProviderRow(
  overrides: Partial<ProviderView> & { id: string },
): ProviderView {
  return {
    slug: `p-${overrides.id}`,
    name: `供应商 ${overrides.id}`,
    baseUrl: 'https://example.invalid',
    timeoutMs: null,
    rateLimitPerMinute: null,
    maxConcurrent: null,
    enabled: true,
    modelCount: 0,
    createdAt: '2026-11-02T00:00:00.000Z',
    ...overrides,
  };
}

/** 内存供应商仓储：记录最近一次 queryTable 入参，供透传断言。 */
class FakeProviderRepository implements ProviderRepository {
  readonly rows: ProviderView[];
  lastQuery: TableQueryRequest | undefined;

  constructor(rows: ProviderView[] = []) {
    this.rows = rows;
  }

  async queryTable(
    query: TableQueryRequest,
  ): Promise<{ items: ProviderView[]; total: number }> {
    this.lastQuery = query;
    const sorted = [...this.rows].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
    return {
      total: sorted.length,
      items: sorted.slice(
        (query.page - 1) * query.pageSize,
        query.page * query.pageSize,
      ),
    };
  }

  async listAggregates(): Promise<ModelProvider[]> {
    return [];
  }

  async findViewById(id: string) {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async findById(): Promise<ModelProvider | null> {
    return null;
  }

  async findBySlug(): Promise<ModelProvider | null> {
    return null;
  }

  async existsBySlug(): Promise<boolean> {
    return false;
  }

  async create(): Promise<ProviderView> {
    throw new Error('本用例不触达 create');
  }

  async saveConfiguration(): Promise<void> {}

  async saveEnabled(): Promise<void> {}

  async remove(): Promise<void> {}
}

function makeService(rows: ProviderView[] = []) {
  const repo = new FakeProviderRepository(rows);
  // 查询路径不触达加解密与上游 HTTP，仅补齐构造签名
  const crypto = {
    encrypt: (value: string) => `enc:${value}`,
  } as unknown as CryptoService;
  return {
    repo,
    service: new ModelProviderService(repo, crypto, {
      probe: async () => ({ ok: true }),
    }),
  };
}

describe('ModelProviderService（应用层）', () => {
  it('queryTable 透传规范请求并返回分页读模型', async () => {
    const { repo, service } = makeService([
      makeProviderRow({ id: 'p1' }),
      makeProviderRow({ id: 'p2', createdAt: '2026-11-01T00:00:00.000Z' }),
    ]);
    const query: TableQueryRequest = {
      page: 1,
      pageSize: 1,
      q: null,
      scope: null,
      filters: [],
      sort: [
        { field: 'status', direction: SortDirection.Desc },
        { field: 'name', direction: SortDirection.Asc },
      ],
    };
    const result = await service.queryTable(query);
    expect(repo.lastQuery).toBe(query);
    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(1);
  });
});
