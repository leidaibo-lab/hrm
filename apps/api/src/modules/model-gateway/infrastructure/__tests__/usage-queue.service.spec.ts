import { describe, expect, it } from 'vitest';
import type { QueueService } from '../../../../platform/queue';
import type { FxRepository } from '../../domain/fx.repository';
import type { PriceRepository } from '../../domain/price.repository';
import type {
  UsageAttemptInput,
  UsageRecordData,
  UsageRepository,
} from '../../domain/usage.repository';
import { UsageQueueService } from '../usage-queue.service';

const attempt: UsageAttemptInput = {
  callId: 'call-1',
  traceId: 'trace-1',
  caller: 'agent',
  logicalModelId: 'logical-1',
  candidateId: 'candidate-1',
  spaceId: null,
  agentKey: null,
  inputTokens: 1000,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  reasoningTokens: 0,
  status: 'success',
  errorCode: null,
  latencyMs: 120,
};

function queueWith(sink: {
  data?: UsageRecordData;
  jobId?: string;
}): QueueService {
  return {
    enqueue: async (
      _queue: string,
      _job: string,
      data: UsageRecordData,
      options?: { jobId?: string },
    ) => {
      sink.data = data;
      sink.jobId = options?.jobId;
      return 'job-1';
    },
    createWorker: () => ({ close: async () => undefined }),
  } as unknown as QueueService;
}

const usageRepo = {
  create: async () => undefined,
} as unknown as UsageRepository;

describe('UsageQueueService', () => {
  it('按手动价与汇率计算成本后入队，jobId=callId', async () => {
    const sink: { data?: UsageRecordData; jobId?: string } = {};
    const service = new UsageQueueService(
      queueWith(sink),
      usageRepo,
      {
        listByCandidate: async () => [
          {
            id: 'price-1',
            candidateId: 'candidate-1',
            source: 'manual',
            currency: 'CNY',
            input: '3',
            output: '15',
            cacheRead: null,
            cacheWrite: null,
            reasoning: null,
            effectiveFrom: new Date(0),
            fetchedAt: null,
            createdAt: new Date(0),
          },
        ],
      } as unknown as PriceRepository,
      {
        findEffective: async () => ({
          id: 'fx-1',
          baseCurrency: 'USD',
          quoteCurrency: 'CNY',
          rateToBase: '0.1389',
          effectiveFrom: new Date(0),
          source: 'manual',
          createdAt: new Date(0),
        }),
      } as unknown as FxRepository,
    );

    await service.enqueue(attempt);

    expect(sink.jobId).toBe('call-1');
    expect(sink.data).toMatchObject({
      callId: 'call-1',
      priceId: 'price-1',
      priceSource: 'manual',
      currency: 'CNY',
      costOriginal: '0.00300000',
      cost: '0.00041670',
      fxRate: '0.1389',
      fxRateId: 'fx-1',
      fxMissing: false,
    });
  });

  it('无价格版本时按 missing 入队，成本为空', async () => {
    const sink: { data?: UsageRecordData; jobId?: string } = {};
    const service = new UsageQueueService(
      queueWith(sink),
      usageRepo,
      { listByCandidate: async () => [] } as unknown as PriceRepository,
      { findEffective: async () => null } as unknown as FxRepository,
    );

    await service.enqueue(attempt);

    expect(sink.data).toMatchObject({
      priceSource: 'missing',
      priceId: null,
      currency: null,
      costOriginal: null,
      cost: null,
      fxRateId: null,
      fxMissing: false,
    });
  });
});
