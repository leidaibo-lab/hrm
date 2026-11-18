import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { QueueService } from '../../../platform/queue';
import type { PricingRates } from '../domain/model-pricing.entity';
import {
  MODEL_PRICING_REPOSITORY,
  type ModelPricingRepository,
} from '../domain/model-pricing.repository';
import {
  MODEL_USAGE_REPOSITORY,
  type ModelUsageRepository,
  type UsageRecord,
} from '../domain/model-usage.repository';

/** 队列载荷：网关计量包装的产出（modelId 由工厂绑定；pricingId/cost 由本消费者解析）。 */
export type UsageJobPayload = Omit<UsageRecord, 'pricingId' | 'cost'> & {
  /** 此输入不接受调用方指定成本。 */
  cost?: never;
};

const MODEL_USAGE_QUEUE = 'model-usage';
const MODEL_USAGE_JOB = 'record';

/**
 * 计量落库消费者（ADR-0015）：取价时点 = 调用完成入队后的处理时刻，
 * ModelUsage.pricingId 记录当时生效版本，调价后历史账单不漂移。
 * 失败任务停留在 BullMQ failed 集合（死信兜底），不重试也不丢推理。
 */
@Injectable()
export class UsageRecordService implements OnModuleInit {
  constructor(
    @Inject(QueueService)
    private readonly queue: QueueService,
    @Inject(MODEL_USAGE_REPOSITORY)
    private readonly usages: ModelUsageRepository,
    @Inject(MODEL_PRICING_REPOSITORY)
    private readonly pricing: ModelPricingRepository,
  ) {}

  onModuleInit(): void {
    this.queue.createWorker<UsageJobPayload>(MODEL_USAGE_QUEUE, async (job) => {
      await this.handle(job.data);
    });
  }

  /** 入队（供测试与手动补录）；生产路径走网关工厂的 enqueueUsage。 */
  enqueue(payload: UsageJobPayload): Promise<string> {
    return this.queue.enqueue(MODEL_USAGE_QUEUE, MODEL_USAGE_JOB, payload);
  }

  private async handle(payload: UsageJobPayload): Promise<void> {
    const effective = await this.pricing.findEffectiveAt(
      payload.modelId,
      new Date(),
    );
    const cost =
      effective === null ? null : computeCost(payload, effective.rates);
    await this.usages.create({
      modelId: payload.modelId,
      pricingId: effective?.id ?? null,
      inputTokens: payload.inputTokens,
      outputTokens: payload.outputTokens,
      reasoningTokens: payload.reasoningTokens,
      cachedInputTokens: payload.cachedInputTokens,
      cacheWriteTokens: payload.cacheWriteTokens,
      latencyMs: payload.latencyMs,
      status: payload.status,
      caller: payload.caller,
      traceId: payload.traceId,
      cost,
    });
  }
}

/**
 * 成本公式（USD / 百万 token 价 × 实际 token）：
 * - 输入按非缓存 token 计价，缓存读写按各自费率；
 * - 推理 token 默认含于输出计价；费率单列时从输出扣除并按推理费率计。
 */
function computeCost(payload: UsageJobPayload, rates: PricingRates): number {
  const billableInput = Math.max(
    0,
    payload.inputTokens - payload.cachedInputTokens - payload.cacheWriteTokens,
  );
  let cost = billableInput * rates.input + payload.outputTokens * rates.output;
  if (rates.cacheRead !== null) {
    cost += payload.cachedInputTokens * rates.cacheRead;
  }
  if (rates.cacheWrite !== null) {
    cost += payload.cacheWriteTokens * rates.cacheWrite;
  }
  if (rates.reasoning !== null && payload.reasoningTokens > 0) {
    cost =
      cost -
      payload.reasoningTokens * rates.output +
      payload.reasoningTokens * rates.reasoning;
  }
  return Math.max(0, Math.round(cost * 1e10) / 1e10);
}
