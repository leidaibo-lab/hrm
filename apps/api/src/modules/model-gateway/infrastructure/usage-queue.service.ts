import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { Job } from 'bullmq';
import { QueueService } from '../../../platform/queue';
import {
  FX_REPOSITORY,
  type FxRecord,
  type FxRepository,
} from '../domain/fx.repository';
import {
  computeCost,
  convertToBase,
  type FxVersion,
  type PriceVersion,
  pickPrice,
  type TokenUsage,
} from '../domain/price.entity';
import {
  PRICE_REPOSITORY,
  type PriceRecord,
  type PriceRepository,
} from '../domain/price.repository';
import {
  USAGE_REPOSITORY,
  type UsageAttemptInput,
  type UsageRecordData,
  type UsageRepository,
  type UsageSinkPort,
} from '../domain/usage.repository';

const USAGE_QUEUE = 'model-gateway-usage';
const USAGE_JOB = 'record';
const USAGE_DEAD_QUEUE = 'model-gateway-usage-dead';
const USAGE_DEAD_JOB = 'record';

/** 计量入队与落库：取价时点 = 调用完成入队时，价格与汇率版本随用量冻结。 */
@Injectable()
export class UsageQueueService implements UsageSinkPort, OnModuleInit {
  private readonly logger = new Logger(UsageQueueService.name);

  constructor(
    @Inject(QueueService)
    private readonly queue: QueueService,
    @Inject(USAGE_REPOSITORY)
    private readonly usages: UsageRepository,
    @Inject(PRICE_REPOSITORY)
    private readonly prices: PriceRepository,
    @Inject(FX_REPOSITORY)
    private readonly fx: FxRepository,
  ) {}

  onModuleInit(): void {
    this.queue.createWorker<UsageRecordData>(USAGE_QUEUE, (job) =>
      this.handleJob(job),
    );
  }

  /** 解析价格与汇率后入队；入队失败只告警，不影响推理。 */
  async enqueue(input: UsageAttemptInput): Promise<void> {
    const at = new Date();
    let priced: PriceSnapshot;
    try {
      priced = await this.resolvePricing(input, at);
    } catch (cause) {
      this.logger.warn(
        '价格解析失败，按缺价入队: ' +
          (cause instanceof Error ? cause.message : String(cause)),
      );
      priced = missingPriceSnapshot();
    }
    try {
      await this.queue.enqueue<UsageRecordData>(
        USAGE_QUEUE,
        USAGE_JOB,
        { ...input, ...priced },
        { jobId: input.callId },
      );
    } catch (cause) {
      this.logger.warn(
        '计量入队失败（不影响推理）: ' +
          (cause instanceof Error ? cause.message : String(cause)),
      );
    }
  }

  /** 消费者：落库失败进死信并告警，再抛出保留 BullMQ 失败记录。 */
  async handleJob(job: Job<UsageRecordData>): Promise<void> {
    try {
      await this.usages.create(job.data);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      this.logger.error(
        `计量落库失败，进入死信: callId=${job.data.callId} ${message}`,
      );
      await this.queue
        .enqueue(
          USAGE_DEAD_QUEUE,
          USAGE_DEAD_JOB,
          { ...job.data, error: message },
          { jobId: job.data.callId },
        )
        .catch((deadCause: unknown) => {
          this.logger.error(
            '死信入队失败: ' +
              (deadCause instanceof Error
                ? deadCause.message
                : String(deadCause)),
          );
        });
      throw cause;
    }
  }

  private async resolvePricing(
    input: UsageAttemptInput,
    at: Date,
  ): Promise<PriceSnapshot> {
    const rows = await this.prices.listByCandidate(input.candidateId);
    const manual = rows
      .filter((row) => row.source === 'manual')
      .map(toPriceVersion);
    const catalogRow =
      rows.find(
        (row) =>
          row.source === 'models_dev' &&
          row.effectiveFrom.getTime() <= at.getTime(),
      ) ?? null;
    const selected = pickPrice(
      manual,
      catalogRow ? toPriceVersion(catalogRow) : null,
      at,
    );
    if (!selected) {
      this.logger.warn(`缺价，成本为空: candidate=${input.candidateId}`);
      return missingPriceSnapshot();
    }
    const tokens: TokenUsage = {
      inputTotal: input.inputTokens,
      cacheRead: input.cacheReadTokens,
      cacheWrite: input.cacheWriteTokens,
      outputTotal: input.outputTokens,
      reasoning: input.reasoningTokens,
    };
    const costOriginal = computeCost(tokens, selected);
    const fxRow = await this.fx.findEffective(selected.currency, at);
    const converted = convertToBase(
      costOriginal,
      selected.currency,
      fxRow ? toFxVersion(fxRow) : null,
      at,
    );
    if (!converted) {
      this.logger.warn(
        '缺汇率，成本为空: candidate=' +
          input.candidateId +
          ' currency=' +
          selected.currency,
      );
      return {
        priceId: selected.id,
        priceSource: selected.source,
        currency: selected.currency,
        costOriginal,
        cost: null,
        fxRate: null,
        fxRateId: null,
        fxMissing: true,
      };
    }
    return {
      priceId: selected.id,
      priceSource: selected.source,
      currency: selected.currency,
      costOriginal,
      cost: converted.cost,
      fxRate: converted.rate,
      fxRateId: converted.fxRateId,
      fxMissing: false,
    };
  }
}

interface PriceSnapshot {
  priceId: string | null;
  priceSource: UsageRecordData['priceSource'];
  currency: string | null;
  costOriginal: string | null;
  cost: string | null;
  fxRate: string | null;
  fxRateId: string | null;
  fxMissing: boolean;
}

function missingPriceSnapshot(): PriceSnapshot {
  return {
    priceId: null,
    priceSource: 'missing',
    currency: null,
    costOriginal: null,
    cost: null,
    fxRate: null,
    fxRateId: null,
    fxMissing: false,
  };
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

function toFxVersion(row: FxRecord): FxVersion {
  return {
    id: row.id,
    currency: row.quoteCurrency,
    rateToBase: row.rateToBase,
    effectiveFrom: row.effectiveFrom,
  };
}
