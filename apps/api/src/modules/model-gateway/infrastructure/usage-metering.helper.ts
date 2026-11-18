import { randomUUID } from 'node:crypto';
import type { ErrorCode } from '@cip/shared';
import type { GatewayLanguageModel } from '@mastra/core/llm';
import { currentCallContext } from '../../../pipeline/call-context';
import type { CandidateEntry } from '../domain/candidate.entity';
import { ModelCallError } from '../domain/model-call.error';
import type {
  BreakerRecorderPort,
  RateLimitPort,
} from '../domain/runtime.port';
import type {
  UsageAttemptInput,
  UsageSinkPort,
  UsageStatus,
} from '../domain/usage.repository';

/** 运行时守卫依赖：限流、熔断记录与计量入队。 */
export interface GatewayGuardDeps {
  /** 限流服务端口。 */
  rateLimit: RateLimitPort;
  /** 熔断结果记录端口。 */
  breaker: BreakerRecorderPort;
  /** 计量记录接收端口。 */
  usage: UsageSinkPort;
  /** 记录警告信息。 */
  logWarn: (message: string) => void;
}

/** 单候选调用上下文：限流与计量按候选归属。 */
export interface GuardedCandidate {
  /** 本次调用使用的候选项。 */
  candidate: CandidateEntry;
  /** 每分钟请求数限制。 */
  rateLimitPerMinute: number | null;
}

/**
 * 模型实例运行时包装（ADR-0084）：每次 doGenerate/doStream 是一次尝试。
 * - 调用前按供应商每分钟限流；
 * - 成功/失败写熔断与用量；
 * - 流式首 chunk 后错误转 error part 并正常结束，避免重放已输出内容。
 */
export function withGatewayGuards<M extends GatewayLanguageModel>(
  inner: M,
  context: GuardedCandidate,
  deps: GatewayGuardDeps,
): M {
  type GenerateOptions = Parameters<M['doGenerate']>[0];
  type StreamOptions = Parameters<M['doStream']>[0];
  const providerId = context.candidate.providerId;

  return {
    specificationVersion: inner.specificationVersion,
    provider: inner.provider,
    modelId: inner.modelId,
    supportedUrls: inner.supportedUrls,
    doGenerate: async (options: GenerateOptions) => {
      try {
        await deps.rateLimit.acquire(providerId, context.rateLimitPerMinute);
      } catch (cause) {
        if (cause instanceof ModelCallError) {
          if (cause.code === 'model.rate_limited') {
            await meter(
              deps,
              context,
              'rate_limited',
              undefined,
              0,
              cause.code,
            );
          }
          throw cause;
        }
        deps.logWarn(
          '限流器异常，fail-open 放行: ' +
            (cause instanceof Error ? cause.message : String(cause)),
        );
      }
      const startedAt = Date.now();
      try {
        const result = await (
          inner.doGenerate as (
            input: GenerateOptions,
          ) => ReturnType<M['doGenerate']>
        )(options);
        deps.breaker.recordSuccess(providerId);
        await meter(
          deps,
          context,
          'success',
          result.usage,
          Date.now() - startedAt,
          null,
        );
        return result;
      } catch (cause) {
        const failure = classifyFailure(cause);
        deps.breaker.recordFailure(providerId, {
          retryable: failure.retryable,
          ...(failure.retryAfterMs === undefined
            ? {}
            : { retryAfterMs: failure.retryAfterMs }),
          at: Date.now(),
        });
        await meter(
          deps,
          context,
          failure.status,
          undefined,
          Date.now() - startedAt,
          failure.code,
        );
        throw cause;
      }
    },
    doStream: async (options: StreamOptions) => {
      try {
        await deps.rateLimit.acquire(providerId, context.rateLimitPerMinute);
      } catch (cause) {
        if (cause instanceof ModelCallError) {
          if (cause.code === 'model.rate_limited') {
            await meter(
              deps,
              context,
              'rate_limited',
              undefined,
              0,
              cause.code,
            );
          }
          throw cause;
        }
        deps.logWarn(
          '限流器异常，fail-open 放行: ' +
            (cause instanceof Error ? cause.message : String(cause)),
        );
      }
      const startedAt = Date.now();
      let result: Awaited<ReturnType<M['doStream']>>;
      try {
        result = await (
          inner.doStream as (input: StreamOptions) => ReturnType<M['doStream']>
        )(options);
      } catch (cause) {
        const failure = classifyFailure(cause);
        deps.breaker.recordFailure(providerId, {
          retryable: failure.retryable,
          ...(failure.retryAfterMs === undefined
            ? {}
            : { retryAfterMs: failure.retryAfterMs }),
          at: Date.now(),
        });
        await meter(
          deps,
          context,
          failure.status,
          undefined,
          Date.now() - startedAt,
          failure.code,
        );
        throw cause;
      }
      return {
        ...result,
        stream: guardStream(
          result.stream as unknown as ReadableStream<unknown>,
          deps,
          context,
          startedAt,
        ) as typeof result.stream,
      };
    },
  } as unknown as M;
}

interface FailureInfo {
  status: UsageStatus;
  code: ErrorCode;
  retryable: boolean;
  retryAfterMs?: number;
}

function guardStream(
  inner: ReadableStream<unknown>,
  deps: GatewayGuardDeps,
  context: GuardedCandidate,
  startedAt: number,
): ReadableStream<unknown> {
  const reader = inner.getReader();
  let sawChunk = false;
  let settled = false;
  let capturedUsage: unknown;
  let failure: FailureInfo | null = null;

  const settleFailure = async (info: FailureInfo): Promise<void> => {
    if (settled) return;
    settled = true;
    deps.breaker.recordFailure(context.candidate.providerId, {
      retryable: info.retryable,
      ...(info.retryAfterMs === undefined
        ? {}
        : { retryAfterMs: info.retryAfterMs }),
      at: Date.now(),
    });
    await meter(
      deps,
      context,
      info.status,
      undefined,
      Date.now() - startedAt,
      info.code,
    );
  };

  const settleSuccess = async (): Promise<void> => {
    if (settled) return;
    settled = true;
    deps.breaker.recordSuccess(context.candidate.providerId);
    await meter(
      deps,
      context,
      'success',
      capturedUsage,
      Date.now() - startedAt,
      null,
    );
  };

  return new ReadableStream<unknown>({
    async pull(controller) {
      if (settled) {
        controller.close();
        return;
      }
      try {
        const { done, value } = await reader.read();
        if (done) {
          if (capturedUsage !== undefined && failure === null) {
            await settleSuccess();
          } else {
            await settleFailure(
              failure ?? {
                status: 'failed',
                code: 'model.provider_unavailable',
                retryable: true,
              },
            );
          }
          controller.close();
          return;
        }
        if (!sawChunk) sawChunk = true;
        inspectChunk(
          value,
          (usage) => {
            capturedUsage = usage;
          },
          (info) => {
            failure = info;
          },
        );
        controller.enqueue(value);
      } catch (cause) {
        const info = classifyFailure(cause);
        await settleFailure(info);
        if (sawChunk) {
          controller.enqueue({ type: 'error', error: cause });
          controller.close();
        } else {
          controller.error(cause);
        }
      }
    },
    async cancel(reason) {
      if (!settled) {
        settled = true;
        await meter(
          deps,
          context,
          'cancelled',
          undefined,
          Date.now() - startedAt,
          'model.request_cancelled',
        );
      }
      await reader.cancel(reason).catch(() => undefined);
    },
  });
}

function inspectChunk(
  value: unknown,
  captureUsage: (usage: unknown) => void,
  markFailure: (info: FailureInfo) => void,
): void {
  if (value === null || typeof value !== 'object') return;
  const part = value as { type?: string; usage?: unknown };
  if (part.type === 'finish') captureUsage(part.usage);
  if (part.type === 'error' || part.type === 'abort') {
    markFailure({
      status: 'failed',
      code: 'model.provider_unavailable',
      retryable: true,
    });
  }
}

async function meter(
  deps: GatewayGuardDeps,
  context: GuardedCandidate,
  status: UsageStatus,
  usage: unknown,
  latencyMs: number,
  errorCode: ErrorCode | null,
): Promise<void> {
  try {
    await deps.usage.enqueue(
      buildAttempt(context, status, usage, latencyMs, errorCode),
    );
  } catch (cause) {
    deps.logWarn(
      '计量入队失败（不影响推理）: ' +
        (cause instanceof Error ? cause.message : String(cause)),
    );
  }
}

function buildAttempt(
  context: GuardedCandidate,
  status: UsageStatus,
  usage: unknown,
  latencyMs: number,
  errorCode: ErrorCode | null,
): UsageAttemptInput {
  const call = currentCallContext();
  const tokens = status === 'success' ? normalizeTokens(usage) : emptyTokens();
  return {
    callId: randomUUID(),
    traceId: call.traceId,
    caller: call.caller,
    logicalModelId: context.candidate.logicalModelId,
    candidateId: context.candidate.id,
    spaceId: null,
    agentKey: null,
    ...tokens,
    status,
    errorCode,
    latencyMs,
  };
}

function classifyFailure(cause: unknown): FailureInfo {
  if (cause instanceof ModelCallError) {
    return {
      status: failureStatus(cause.code),
      code: cause.code,
      retryable: cause.isRetryable,
      ...(cause.retryAfterMs === undefined
        ? {}
        : { retryAfterMs: cause.retryAfterMs }),
    };
  }
  const statusCode = httpStatus(cause);
  if (statusCode === 429) {
    return {
      status: 'rate_limited',
      code: 'model.rate_limited',
      retryable: true,
      ...(retryAfterMs(cause) === undefined
        ? {}
        : { retryAfterMs: retryAfterMs(cause) }),
    };
  }
  if (statusCode === 401 || statusCode === 403) {
    return {
      status: 'failed',
      code: 'model.credential_invalid',
      retryable: false,
    };
  }
  if (statusCode === 404) {
    return {
      status: 'failed',
      code: 'model.model_not_found',
      retryable: false,
    };
  }
  if (statusCode === 408) {
    return { status: 'failed', code: 'model.timeout', retryable: true };
  }
  if (statusCode !== undefined && statusCode >= 400 && statusCode < 500) {
    return {
      status: 'failed',
      code: 'model.request_invalid',
      retryable: false,
    };
  }
  if (statusCode !== undefined && statusCode >= 500) {
    return {
      status: 'failed',
      code: 'model.provider_unavailable',
      retryable: true,
    };
  }
  const name = cause instanceof Error ? cause.name : '';
  if (name === 'TimeoutError' || name === 'AbortError') {
    return { status: 'failed', code: 'model.timeout', retryable: true };
  }
  return {
    status: 'failed',
    code: 'model.provider_unavailable',
    retryable: true,
  };
}

function failureStatus(code: ErrorCode): UsageStatus {
  if (code === 'model.rate_limited') return 'rate_limited';
  if (code === 'model.request_cancelled') return 'cancelled';
  return 'failed';
}

function httpStatus(cause: unknown): number | undefined {
  if (cause === null || typeof cause !== 'object') return undefined;
  const record = cause as { statusCode?: unknown; status?: unknown };
  const value = record.statusCode ?? record.status;
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function retryAfterMs(cause: unknown): number | undefined {
  if (cause === null || typeof cause !== 'object') return undefined;
  const record = cause as {
    responseHeaders?: Record<string, string>;
    headers?: Record<string, string>;
  };
  const headers = record.responseHeaders ?? record.headers;
  const raw = headers?.['retry-after'] ?? headers?.['Retry-After'];
  if (raw === undefined) return undefined;
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : undefined;
}

/** usage 双形态归一：V4 嵌套与 V2/V3 平铺。 */
function normalizeTokens(usage: unknown): {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number;
} {
  if (usage === null || typeof usage !== 'object') return emptyTokens();
  const candidate = usage as UsageShape;
  const input = candidate.inputTokens;
  if (input !== null && typeof input === 'object') {
    const output =
      candidate.outputTokens !== null &&
      typeof candidate.outputTokens === 'object'
        ? candidate.outputTokens
        : undefined;
    return {
      inputTokens: asCount(input.total),
      outputTokens: asCount(output?.total),
      cacheReadTokens: asCount(input.cacheRead),
      cacheWriteTokens: asCount(input.cacheWrite),
      reasoningTokens: asCount(output?.reasoning),
    };
  }
  return {
    inputTokens: asCount(input),
    outputTokens: asCount(candidate.outputTokens),
    cacheReadTokens: asCount(candidate.cachedInputTokens),
    cacheWriteTokens: 0,
    reasoningTokens: asCount(candidate.reasoningTokens),
  };
}

interface UsageShape {
  inputTokens?: number | UsageShapeNestedInput | null;
  outputTokens?: number | UsageShapeNestedOutput | null;
  reasoningTokens?: number | null;
  cachedInputTokens?: number | null;
}

interface UsageShapeNestedInput {
  total?: number | null;
  cacheRead?: number | null;
  cacheWrite?: number | null;
}

interface UsageShapeNestedOutput {
  total?: number | null;
  reasoning?: number | null;
}

function asCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : 0;
}

function emptyTokens(): {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number;
} {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    reasoningTokens: 0,
  };
}
