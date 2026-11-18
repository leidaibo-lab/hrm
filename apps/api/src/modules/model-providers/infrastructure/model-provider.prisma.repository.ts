import type { TableQueryRequest } from '@cip/shared';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma';
import type { Prisma } from '../../../platform/prisma/generated/client';
import {
  buildTableOrderBy,
  buildTableWhere,
  tablePageArgs,
} from '../../../platform/table-query';
import type { ModelProvider } from '../domain/model-provider.entity';
import {
  type ProviderConfigurationField,
  type ProviderRepository,
  type ProviderView,
} from '../domain/model-provider.repository';
import { toPersistenceError } from './model-persistence.helper';
import { toProviderDomain } from './model-provider.mapper';

/** ProviderRepository 的 Prisma 实现：取存细节收口在此；凭据只以密文形态进出。 */
@Injectable()
export class ModelProviderPrismaRepository implements ProviderRepository {
  /** 展示字段 → 存储列绑定：status 为 enabled 布尔列的显式投影（PRD 资源端点映射）。 */
  private static readonly bindings = {
    name: { type: 'column', column: 'name' },
    slug: { type: 'column', column: 'slug' },
    baseUrl: { type: 'column', column: 'baseUrl' },
    status: {
      type: 'boolean',
      column: 'enabled',
      truthy: 'enabled',
      falsy: 'disabled',
    },
    createdAt: { type: 'column', column: 'createdAt' },
  } as const;

  private static readonly qColumns = ['name', 'slug', 'baseUrl'] as const;

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async queryTable(query: TableQueryRequest): Promise<{
    items: ProviderView[];
    total: number;
  }> {
    const where: Prisma.ModelProviderWhereInput = buildTableWhere(
      query,
      ModelProviderPrismaRepository.bindings,
      null,
      ModelProviderPrismaRepository.qColumns,
    ) as Prisma.ModelProviderWhereInput;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.modelProvider.findMany({
        where,
        include: { _count: { select: { models: true } } },
        orderBy: buildTableOrderBy(
          query,
          ModelProviderPrismaRepository.bindings,
        ) as Prisma.ModelProviderOrderByWithRelationInput[],
        ...tablePageArgs(query),
      }),
      this.prisma.modelProvider.count({ where }),
    ]);
    return {
      total,
      items: rows.map((row) => this.toView(row, row._count.models)),
    };
  }

  async listAggregates(): Promise<ModelProvider[]> {
    const rows = await this.prisma.modelProvider.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toProviderDomain);
  }

  async findViewById(id: string): Promise<ProviderView | null> {
    const row = await this.prisma.modelProvider.findUnique({
      where: { id },
      include: { _count: { select: { models: true } } },
    });
    return row ? this.toView(row, row._count.models) : null;
  }

  async findById(id: string): Promise<ModelProvider | null> {
    const row = await this.prisma.modelProvider.findUnique({ where: { id } });
    return row ? toProviderDomain(row) : null;
  }

  async findBySlug(slug: string): Promise<ModelProvider | null> {
    const row = await this.prisma.modelProvider.findUnique({ where: { slug } });
    return row ? toProviderDomain(row) : null;
  }

  async existsBySlug(slug: string): Promise<boolean> {
    const row = await this.prisma.modelProvider.findUnique({
      where: { slug },
      select: { id: true },
    });
    return row !== null;
  }

  async create(provider: ModelProvider): Promise<ProviderView> {
    const row = await this.prisma.modelProvider
      .create({
        data: {
          slug: provider.slug,
          name: provider.name,
          baseUrl: provider.baseUrl,
          apiKeyCipher: provider.apiKeyCipher,
          timeoutMs: provider.timeoutMs,
          rateLimitPerMinute: provider.rateLimitPerMinute,
          maxConcurrent: provider.maxConcurrent,
        },
      })
      .catch((cause) => {
        throw toPersistenceError(cause);
      });
    // 新建供应商必然没有模型
    return this.toView(row, 0);
  }

  async saveConfiguration(
    provider: ModelProvider,
    fields: readonly ProviderConfigurationField[],
  ): Promise<void> {
    if (fields.length === 0) return;
    const data: Prisma.ModelProviderUpdateInput = {};
    for (const field of fields) {
      switch (field) {
        case 'name':
          data.name = provider.name;
          break;
        case 'baseUrl':
          data.baseUrl = provider.baseUrl;
          break;
        case 'apiKeyCipher':
          data.apiKeyCipher = provider.apiKeyCipher;
          break;
        case 'timeoutMs':
          data.timeoutMs = provider.timeoutMs;
          break;
        case 'rateLimitPerMinute':
          data.rateLimitPerMinute = provider.rateLimitPerMinute;
          break;
        case 'maxConcurrent':
          data.maxConcurrent = provider.maxConcurrent;
          break;
      }
    }
    await this.prisma.modelProvider.update({
      where: { id: provider.id },
      data,
    });
  }

  async saveEnabled(provider: ModelProvider): Promise<void> {
    await this.prisma.modelProvider.update({
      where: { id: provider.id },
      data: { enabled: provider.isEnabled },
    });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.modelProvider.delete({ where: { id } }).catch((cause) => {
      throw toPersistenceError(cause);
    });
  }

  private toView(
    row: {
      id: string;
      slug: string;
      name: string;
      baseUrl: string;
      timeoutMs: number | null;
      rateLimitPerMinute: number | null;
      maxConcurrent: number | null;
      enabled: boolean;
      createdAt: Date;
    },
    modelCount: number,
  ): ProviderView {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      baseUrl: row.baseUrl,
      timeoutMs: row.timeoutMs,
      rateLimitPerMinute: row.rateLimitPerMinute,
      maxConcurrent: row.maxConcurrent,
      enabled: row.enabled,
      modelCount,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
