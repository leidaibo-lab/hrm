import { ERROR_CODE } from '@cip/shared';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma';
import type { ProviderHealth } from '../domain/provider.entity';
import {
  type ProviderCreateData,
  type ProviderRecord,
  type ProviderRepository,
  type ProviderUpdateData,
} from '../domain/provider.repository';
import { translatePersistenceError } from './persistence.helper';

interface ProviderRow {
  id: string;
  name: string;
  slug: string;
  protocol: string;
  baseUrl: string;
  apiKeyCipher: string;
  catalogProviderId: string | null;
  timeoutMs: number | null;
  enabled: boolean;
  health: string;
  openUntil: Date | null;
  consecutiveFailures: number;
  rateLimitPerMinute: number | null;
  maxConcurrent: number | null;
  createdAt: Date;
}

/** ProviderRepository 的 Prisma 实现：凭据只以密文形态进出。 */
@Injectable()
export class ProviderPrismaRepository implements ProviderRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async list(): Promise<ProviderRecord[]> {
    const rows = await this.prisma.modelGatewayProvider.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => toRecord(row));
  }

  async findById(id: string): Promise<ProviderRecord | null> {
    const row = await this.prisma.modelGatewayProvider.findUnique({
      where: { id },
    });
    return row ? toRecord(row) : null;
  }

  async existsBySlug(slug: string): Promise<boolean> {
    const row = await this.prisma.modelGatewayProvider.findUnique({
      where: { slug },
      select: { id: true },
    });
    return row !== null;
  }

  async create(data: ProviderCreateData): Promise<ProviderRecord> {
    const row = await this.prisma.modelGatewayProvider
      .create({
        data: {
          name: data.name,
          slug: data.slug,
          baseUrl: data.baseUrl,
          apiKeyCipher: data.apiKeyCipher,
          catalogProviderId: data.catalogProviderId,
          timeoutMs: data.timeoutMs,
          rateLimitPerMinute: data.rateLimitPerMinute,
          maxConcurrent: data.maxConcurrent,
        },
      })
      .catch((cause: unknown) =>
        translatePersistenceError(cause, {
          conflict: ERROR_CODE.model.slugConflict,
        }),
      );
    return toRecord(row);
  }

  async update(id: string, data: ProviderUpdateData): Promise<ProviderRecord> {
    const row = await this.prisma.modelGatewayProvider
      .update({
        where: { id },
        data: {
          ...(data.name === undefined ? {} : { name: data.name }),
          ...(data.baseUrl === undefined ? {} : { baseUrl: data.baseUrl }),
          ...(data.apiKeyCipher === undefined
            ? {}
            : { apiKeyCipher: data.apiKeyCipher }),
          ...(data.catalogProviderId === undefined
            ? {}
            : { catalogProviderId: data.catalogProviderId }),
          ...(data.timeoutMs === undefined
            ? {}
            : { timeoutMs: data.timeoutMs }),
          ...(data.rateLimitPerMinute === undefined
            ? {}
            : { rateLimitPerMinute: data.rateLimitPerMinute }),
          ...(data.maxConcurrent === undefined
            ? {}
            : { maxConcurrent: data.maxConcurrent }),
        },
      })
      .catch((cause: unknown) =>
        translatePersistenceError(cause, {
          conflict: ERROR_CODE.model.slugConflict,
        }),
      );
    return toRecord(row);
  }

  async setEnabled(id: string, enabled: boolean): Promise<ProviderRecord> {
    const row = await this.prisma.modelGatewayProvider.update({
      where: { id },
      data: { enabled },
    });
    return toRecord(row);
  }
}

function toRecord(row: ProviderRow): ProviderRecord {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    protocol: 'openai_compatible',
    baseUrl: row.baseUrl,
    apiKeyCipher: row.apiKeyCipher,
    catalogProviderId: row.catalogProviderId,
    timeoutMs: row.timeoutMs,
    enabled: row.enabled,
    health: row.health as ProviderHealth,
    openUntil: row.openUntil,
    consecutiveFailures: row.consecutiveFailures,
    rateLimitPerMinute: row.rateLimitPerMinute,
    maxConcurrent: row.maxConcurrent,
    createdAt: row.createdAt,
  };
}
