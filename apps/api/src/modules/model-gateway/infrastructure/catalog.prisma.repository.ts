import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma';
import {
  type CatalogSyncCreateData,
  type CatalogSyncRecord,
  type CatalogSyncRepository,
  type CatalogSyncStatus,
} from '../domain/catalog.repository';

interface CatalogSyncRow {
  id: string;
  startedAt: Date;
  finishedAt: Date | null;
  status: string;
  providers: number;
  models: number;
  pricesWritten: number;
  unmatched: number;
  error: string | null;
  createdAt: Date;
}

/** CatalogSyncRepository 的 Prisma 实现：只追加，失败记录同样留痕。 */
@Injectable()
export class CatalogSyncPrismaRepository implements CatalogSyncRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async create(data: CatalogSyncCreateData): Promise<CatalogSyncRecord> {
    const row = await this.prisma.modelGatewayCatalogSync.create({
      data: {
        startedAt: data.startedAt,
        finishedAt: data.finishedAt,
        status: data.status,
        providers: data.providers,
        models: data.models,
        pricesWritten: data.pricesWritten,
        unmatched: data.unmatched,
        error: data.error,
      },
    });
    return toRecord(row);
  }

  async list(limit: number): Promise<CatalogSyncRecord[]> {
    const rows = await this.prisma.modelGatewayCatalogSync.findMany({
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
    return rows.map(toRecord);
  }
}

function toRecord(row: CatalogSyncRow): CatalogSyncRecord {
  return {
    id: row.id,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
    status: row.status as CatalogSyncStatus,
    providers: row.providers,
    models: row.models,
    pricesWritten: row.pricesWritten,
    unmatched: row.unmatched,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
  };
}
