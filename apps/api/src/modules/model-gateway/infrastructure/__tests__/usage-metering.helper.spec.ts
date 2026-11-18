import type { ModelCapabilities } from '@cip/shared';
import type { GatewayLanguageModel } from '@mastra/core/llm';
import { describe, expect, it } from 'vitest';
import type { CandidateEntry } from '../../domain/candidate.entity';
import type { UsageAttemptInput } from '../../domain/usage.repository';
import {
  type GatewayGuardDeps,
  withGatewayGuards,
} from '../usage-metering.helper';

const capabilities: ModelCapabilities = {
  contextWindow: 128_000,
  maxOutputTokens: 8_192,
  toolCall: true,
  imageInput: false,
  audioInput: false,
  structuredOutput: true,
  reasoning: false,
  embedding: false,
  streaming: true,
};

const candidate: CandidateEntry = {
  id: 'candidate-1',
  logicalModelId: 'logical-1',
  providerId: 'provider-1',
  providerSlug: 'provider',
  providerModelId: 'model-1',
  priority: 1,
  enabled: true,
  capabilities,
  providerEnabled: true,
  providerHealth: 'healthy',
  providerOpenUntil: null,
};

function modelWith(stream: ReadableStream<unknown>): GatewayLanguageModel {
  return {
    specificationVersion: 'v2',
    provider: 'test',
    modelId: 'model-1',
    supportedUrls: {},
    doGenerate: async () => ({ usage: {} }),
    doStream: async () => ({ stream }),
  } as unknown as GatewayLanguageModel;
}

function depsWith(attempts: UsageAttemptInput[]): {
  deps: GatewayGuardDeps;
  failures: () => number;
} {
  let failures = 0;
  return {
    deps: {
      rateLimit: { acquire: async () => undefined },
      breaker: {
        allows: () => true,
        recordSuccess: () => undefined,
        recordFailure: () => {
          failures += 1;
        },
      },
      usage: {
        enqueue: async (input) => {
          attempts.push(input);
        },
      },
      logWarn: () => undefined,
    },
    failures: () => failures,
  };
}

async function drain(stream: ReadableStream<unknown>): Promise<unknown[]> {
  const reader = stream.getReader();
  const parts: unknown[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return parts;
    parts.push(value);
  }
}

describe('withGatewayGuards 流式计量', () => {
  it('首 chunk 后上游错误转 error part 并记录 failed 尝试', async () => {
    let step = 0;
    const stream = new ReadableStream<unknown>({
      pull(controller) {
        if (step === 0) {
          step = 1;
          controller.enqueue({ type: 'text-delta', textDelta: 'hi' });
          return;
        }
        controller.error(new Error('upstream broke'));
      },
    });
    const attempts: UsageAttemptInput[] = [];
    const { deps, failures } = depsWith(attempts);
    const guarded = withGatewayGuards(
      modelWith(stream),
      { candidate, rateLimitPerMinute: 10 },
      deps,
    );

    const result = await guarded.doStream({} as never);
    const parts = await drain(
      result.stream as unknown as ReadableStream<unknown>,
    );

    expect(parts[0]).toMatchObject({ type: 'text-delta' });
    expect(parts.at(-1)).toMatchObject({ type: 'error' });
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({
      logicalModelId: 'logical-1',
      candidateId: 'candidate-1',
      status: 'failed',
      errorCode: 'model.provider_unavailable',
      inputTokens: 0,
      outputTokens: 0,
    });
    expect(failures()).toBe(1);
  });

  it('finish 正常结束记录 success 与 tokens', async () => {
    const stream = new ReadableStream<unknown>({
      start(controller) {
        controller.enqueue({
          type: 'finish',
          usage: {
            inputTokens: { total: 10, cacheRead: 2, cacheWrite: 1 },
            outputTokens: { total: 5, reasoning: 0 },
          },
        });
        controller.close();
      },
    });
    const attempts: UsageAttemptInput[] = [];
    const { deps } = depsWith(attempts);
    const guarded = withGatewayGuards(
      modelWith(stream),
      { candidate, rateLimitPerMinute: 10 },
      deps,
    );

    const result = await guarded.doStream({} as never);
    await drain(result.stream as unknown as ReadableStream<unknown>);

    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({
      status: 'success',
      inputTokens: 10,
      outputTokens: 5,
      cacheReadTokens: 2,
      cacheWriteTokens: 1,
      reasoningTokens: 0,
    });
  });
});
