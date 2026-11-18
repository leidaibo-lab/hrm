import { ERROR_CODE } from '@cip/shared';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MODEL_REPOSITORY,
  type ModelRepository,
} from '../domain/model.repository';
import { PersistenceError } from '../domain/persistence.error';
import { type PriceVersion, pickPrice } from '../domain/price.entity';
import {
  PRICE_REPOSITORY,
  type PriceRecord,
  type PriceRepository,
  type PriceVersionView,
} from '../domain/price.repository';
import { SNAPSHOT_PORT, type SnapshotPort } from '../domain/runtime.port';

/** 价格版本应用服务：手动价优先、目录价兜底；只追加，历史成本不重算。 */
@Injectable()
export class PriceService {
  constructor(
    @Inject(PRICE_REPOSITORY)
    private readonly prices: PriceRepository,
    @Inject(MODEL_REPOSITORY)
    private readonly models: ModelRepository,
    @Inject(SNAPSHOT_PORT)
    private readonly snapshot: SnapshotPort & { invalidate(): void },
  ) {}

  async list(candidateId: string): Promise<PriceVersionView[]> {
    await this.mustFindCandidate(candidateId);
    const rows = await this.prices.listByCandidate(candidateId);
    return withStatus(rows, new Date());
  }

  async createManual(
    candidateId: string,
    input: {
      currency: string;
      input: string;
      output: string;
      cacheRead: string | null;
      cacheWrite: string | null;
      reasoning: string | null;
      effectiveFrom: string;
    },
  ): Promise<PriceVersionView> {
    await this.mustFindCandidate(candidateId);
    const record = await this.prices
      .createManual({
        candidateId,
        currency: input.currency,
        input: input.input,
        output: input.output,
        cacheRead: input.cacheRead,
        cacheWrite: input.cacheWrite,
        reasoning: input.reasoning,
        effectiveFrom: new Date(input.effectiveFrom),
      })
      .catch((cause: unknown) => this.rethrow(cause));
    this.snapshot.invalidate();
    return withStatus([record], new Date())[0];
  }

  async remove(candidateId: string, priceId: string): Promise<void> {
    await this.mustFindCandidate(candidateId);
    const price = await this.prices.findById(priceId);
    if (!price || price.candidateId !== candidateId) {
      throw new NotFoundException({
        code: ERROR_CODE.model.priceNotFound,
        message: '价格版本不存在',
      });
    }
    await this.prices.remove(priceId).catch((cause: unknown) => {
      if (cause instanceof PersistenceError) {
        throw new ConflictException({
          code: cause.code,
          message: cause.message,
        });
      }
      throw cause;
    });
    this.snapshot.invalidate();
  }

  /** 按调用完成时点取价：手动价 → 目录价 → 缺失。 */
  async resolvePrice(
    candidateId: string,
    at: Date,
  ): Promise<PriceVersion | null> {
    const rows = await this.prices.listByCandidate(candidateId);
    const manual = rows
      .filter((row) => row.source === 'manual')
      .map(toPriceVersion);
    const catalog = rows
      .filter((row) => row.source === 'models_dev')
      .map(toPriceVersion)[0];
    return pickPrice(manual, catalog ?? null, at);
  }

  private async mustFindCandidate(candidateId: string): Promise<void> {
    const candidate = await this.models.findCandidate(candidateId);
    if (!candidate) {
      throw new NotFoundException({
        code: ERROR_CODE.model.candidateNotFound,
        message: '候选不存在',
      });
    }
  }

  private rethrow(cause: unknown): never {
    if (cause instanceof PersistenceError) {
      throw new ConflictException({ code: cause.code, message: cause.message });
    }
    throw cause;
  }
}

function withStatus(
  rows: readonly PriceRecord[],
  now: Date,
): PriceVersionView[] {
  let activeAssigned = false;
  return rows.map((row) => {
    let status: PriceVersionView['status'];
    if (row.effectiveFrom.getTime() > now.getTime()) {
      status = 'pending';
    } else if (!activeAssigned) {
      status = 'active';
      activeAssigned = true;
    } else {
      status = 'history';
    }
    return { ...row, status };
  });
}

function toPriceVersion(row: PriceRecord): PriceVersion {
  return {
    id: row.id,
    source: row.source,
    currency: row.currency,
    input: row.input,
    output: row.output,
    cacheRead: row.cacheRead,
    cacheWrite: row.cacheWrite,
    reasoning: row.reasoning,
    effectiveFrom: row.effectiveFrom,
  };
}
