import { ERROR_CODE } from '@cip/shared';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma';
import {
  type FxCreateData,
  type FxRecord,
  type FxRepository,
} from '../domain/fx.repository';
import { translatePersistenceError } from './persistence.helper';

interface FxRow {
  id: string;
  baseCurrency: string;
  quoteCurrency: string;
  rateToBase: { toString(): string };
  effectiveFrom: Date;
  source: string;
  createdAt: Date;
}

/** FxRepository 的 Prisma 实现：只追加，rate_to_base 方向固定。 */
@Injectable()
export class FxPrismaRepository implements FxRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async list(): Promise<FxRecord[]> {
    const rows = await this.prisma.modelGatewayFxRate.findMany({
      orderBy: [{ quoteCurrency: 'asc' }, { effectiveFrom: 'desc' }],
    });
    return rows.map(toRecord);
  }

  async findEffective(currency: string, at: Date): Promise<FxRecord | null> {
    const row = await this.prisma.modelGatewayFxRate.findFirst({
      where: {
        baseCurrency: 'USD',
        quoteCurrency: currency,
        effectiveFrom: { lte: at },
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    return row ? toRecord(row) : null;
  }

  async create(data: FxCreateData): Promise<FxRecord> {
    const row = await this.prisma.modelGatewayFxRate
      .create({
        data: {
          baseCurrency: 'USD',
          quoteCurrency: data.quoteCurrency,
          rateToBase: data.rateToBase,
          effectiveFrom: data.effectiveFrom,
        },
      })
      .catch((cause: unknown) =>
        translatePersistenceError(cause, {
          conflict: ERROR_CODE.model.fxConflict,
        }),
      );
    return toRecord(row);
  }
}

function toRecord(row: FxRow): FxRecord {
  return {
    id: row.id,
    baseCurrency: row.baseCurrency,
    quoteCurrency: row.quoteCurrency,
    rateToBase: row.rateToBase.toString(),
    effectiveFrom: row.effectiveFrom,
    source: 'manual',
    createdAt: row.createdAt,
  };
}
