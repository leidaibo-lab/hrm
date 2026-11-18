import { ConflictException, Inject, Injectable } from '@nestjs/common';
import {
  FX_REPOSITORY,
  type FxRecord,
  type FxRepository,
} from '../domain/fx.repository';
import { PersistenceError } from '../domain/persistence.error';
import { SNAPSHOT_PORT, type SnapshotPort } from '../domain/runtime.port';

/** 汇率读模型：rateToBase 为 1 单位原币折合多少 USD。 */
export interface FxView {
  /** 记录标识。 */
  id: string;
  /** 基准币种。 */
  baseCurrency: string;
  /** 报价币种。 */
  quoteCurrency: string;
  /** 折算到基准币种的汇率。 */
  rateToBase: string;
  /** 生效时间。 */
  effectiveFrom: string;
  /** 来源。 */
  source: string;
  /** 创建时间。 */
  createdAt: string;
}

/** 汇率应用服务：只追加，历史成本不重算。 */
@Injectable()
export class FxService {
  constructor(
    @Inject(FX_REPOSITORY)
    private readonly rates: FxRepository,
    @Inject(SNAPSHOT_PORT)
    private readonly snapshot: SnapshotPort & { invalidate(): void },
  ) {}

  async list(): Promise<FxView[]> {
    return (await this.rates.list()).map(toView);
  }

  async create(input: {
    quoteCurrency: string;
    rateToBase: string;
    effectiveFrom: string;
  }): Promise<FxView> {
    const record = await this.rates
      .create({
        quoteCurrency: input.quoteCurrency,
        rateToBase: input.rateToBase,
        effectiveFrom: new Date(input.effectiveFrom),
      })
      .catch((cause: unknown) => {
        if (cause instanceof PersistenceError) {
          throw new ConflictException({
            code: cause.code,
            message: cause.message,
          });
        }
        throw cause;
      });
    this.snapshot.invalidate();
    return toView(record);
  }
}

function toView(row: FxRecord): FxView {
  return {
    id: row.id,
    baseCurrency: row.baseCurrency,
    quoteCurrency: row.quoteCurrency,
    rateToBase: row.rateToBase,
    effectiveFrom: row.effectiveFrom.toISOString(),
    source: row.source,
    createdAt: row.createdAt.toISOString(),
  };
}
