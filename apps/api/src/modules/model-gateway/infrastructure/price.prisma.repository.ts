import { ERROR_CODE } from '@cip/shared';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma';
import type { PriceSource } from '../domain/price.entity';
import {
  type CatalogPriceData,
  type ManualPriceCreateData,
  type PriceRecord,
  type PriceRepository,
} from '../domain/price.repository';
import { translatePersistenceError } from './persistence.helper';

interface PriceRow {
  id: string;
  candidateId: string;
  source: string;
  currency: string;
  input: { toString(): string };
  output: { toString(): string };
  cacheRead: { toString(): string } | null;
  cacheWrite: { toString(): string } | null;
  reasoning: { toString(): string } | null;
  effectiveFrom: Date;
  fetchedAt: Date | null;
  createdAt: Date;
}

/** PriceRepository 的 Prisma 实现：只追加，金额 Decimal 以字符串出仓。 */
@Injectable()
export class PricePrismaRepository implements PriceRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async listByCandidate(candidateId: string): Promise<PriceRecord[]> {
    const rows = await this.prisma.modelGatewayPrice.findMany({
      where: { candidateId },
      orderBy: { effectiveFrom: 'desc' },
    });
    return rows.map(toRecord);
  }

  async findAll(): Promise<PriceRecord[]> {
    const rows = await this.prisma.modelGatewayPrice.findMany({
      orderBy: [{ candidateId: 'asc' }, { effectiveFrom: 'desc' }],
    });
    return rows.map(toRecord);
  }

  async findById(id: string): Promise<PriceRecord | null> {
    const row = await this.prisma.modelGatewayPrice.findUnique({
      where: { id },
    });
    return row ? toRecord(row) : null;
  }

  async createManual(data: ManualPriceCreateData): Promise<PriceRecord> {
    const row = await this.prisma.modelGatewayPrice
      .create({
        data: {
          candidateId: data.candidateId,
          source: 'manual',
          currency: data.currency,
          input: data.input,
          output: data.output,
          cacheRead: data.cacheRead,
          cacheWrite: data.cacheWrite,
          reasoning: data.reasoning,
          effectiveFrom: data.effectiveFrom,
        },
      })
      .catch((cause: unknown) =>
        translatePersistenceError(cause, {
          conflict: ERROR_CODE.model.priceConflict,
        }),
      );
    return toRecord(row);
  }

  /**
   * 写入目录价：费率与最近一版相同则跳过（返回 null），否则追加新版本。
   * 同一毫秒的并发同步按唯一约束去重，仍返回 null。
   */
  async recordCatalog(data: CatalogPriceData): Promise<PriceRecord | null> {
    const latest = await this.prisma.modelGatewayPrice.findFirst({
      where: { candidateId: data.candidateId, source: 'models_dev' },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (latest && sameRates(latest, data)) return null;
    try {
      const row = await this.prisma.modelGatewayPrice.create({
        data: {
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
        },
      });
      return toRecord(row);
    } catch (cause) {
      if ((cause as { code?: unknown }).code === 'P2002') return null;
      throw cause;
    }
  }

  async remove(id: string): Promise<void> {
    await this.prisma.modelGatewayPrice
      .delete({ where: { id } })
      .catch((cause: unknown) =>
        translatePersistenceError(cause, {
          conflict: ERROR_CODE.model.priceConflict,
          referenced: ERROR_CODE.model.inUse,
        }),
      );
  }
}

function sameRates(row: PriceRow, data: CatalogPriceData): boolean {
  return (
    row.currency === data.currency &&
    row.input.toString() === data.input &&
    row.output.toString() === data.output &&
    (row.cacheRead?.toString() ?? null) === data.cacheRead &&
    (row.cacheWrite?.toString() ?? null) === data.cacheWrite &&
    (row.reasoning?.toString() ?? null) === data.reasoning
  );
}

function toRecord(row: PriceRow): PriceRecord {
  return {
    id: row.id,
    candidateId: row.candidateId,
    source: row.source as PriceSource,
    currency: row.currency,
    input: row.input.toString(),
    output: row.output.toString(),
    cacheRead: row.cacheRead?.toString() ?? null,
    cacheWrite: row.cacheWrite?.toString() ?? null,
    reasoning: row.reasoning?.toString() ?? null,
    effectiveFrom: row.effectiveFrom,
    fetchedAt: row.fetchedAt,
    createdAt: row.createdAt,
  };
}
