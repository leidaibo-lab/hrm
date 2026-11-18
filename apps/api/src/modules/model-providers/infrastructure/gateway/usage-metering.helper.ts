import type { GatewayLanguageModel } from '@mastra/core/llm';
import { currentCallContext } from '../../../../pipeline/call-context';
import type { UsageStatusValue } from '../../domain/model-usage.repository';
import type { ModelRateLimitedError } from './model-rate-limiter.service';

/** 计量入队载荷：modelId 由工厂绑定、pricingId 由消费者解析（取价时点=入队后处理，ADR-0015）。 */
export type UsageSinkPayload = {
  /** 输入 token 数量。 */
  inputTokens: number;
  /** 输出 token 数量。 */
  outputTokens: number;
  /** 推理 token 数量。 */
  reasoningTokens: number;
  /** 缓存读取 token 数量。 */
  cachedInputTokens: number;
  /** 缓存写入 token 数量。 */
  cacheWriteTokens: number;
  /** 耗时，单位为毫秒。 */
  latencyMs: number;
  /** 状态。 */
  status: UsageStatusValue;
  /** 调用方。 */
  caller: string | null;
  /** 链路追踪标识。 */
  traceId: string | null;
};

/** 网关守卫依赖：计量入队与并发槽借还，由网关工厂装配。 */
export interface MeteringDeps {
  /** 计量入队（fire-and-forget；失败只告警，不影响推理）。 */
  enqueueUsage: (payload: UsageSinkPayload) => void;
  /** 供应商并发槽获取；超时抛 ModelRateLimitedError；返回是否真实占槽。 */
  acquireSlot: () => Promise<boolean>;
  /** 释放已占用的并发槽位。 */
  releaseSlot: () => void;
}

/**
 * 模型实例守卫包装（ADR-0015）：限流 + 计量内建于网关产出实例。
 * usage 与 mastra 可观测性同源（AI SDK 官方解析值）；V4 嵌套 / V2·V3 平铺双形态归一。
 * LanguageModel 为纯对象接口，包装后仍是合法模型实例（mastra 直接消费）。
 */
export function withModelGuards<M extends GatewayLanguageModel>(
  inner: M,
  deps: MeteringDeps,
): M {
  type GenerateOptions = Parameters<M['doGenerate']>[0];
  type StreamOptions = Parameters<M['doStream']>[0];
  return {
    specificationVersion: inner.specificationVersion,
    provider: inner.provider,
    modelId: inner.modelId,
    supportedUrls: inner.supportedUrls,
    doGenerate: async (options: GenerateOptions) => {
      const startedAt = Date.now();
      // acquireSlot 返回是否真实占槽：fail-open 放行 / 未配置上限时不归还（回归审查 P1）
      const acquired = await deps.acquireSlot();
      try {
        const result = await (
          inner.doGenerate as (
            o: GenerateOptions,
          ) => ReturnType<M['doGenerate']>
        )(options);
        sinkUsage(deps, 'success', result.usage, Date.now() - startedAt);
        return result;
      } catch (cause) {
        sinkUsage(
          deps,
          failureStatus(cause),
          undefined,
          Date.now() - startedAt,
        );
        throw cause;
      } finally {
        if (acquired) deps.releaseSlot();
      }
    },
    doStream: async (options: StreamOptions) => {
      const acquired = await deps.acquireSlot();
      const startedAt = Date.now();
      try {
        const result = await (
          inner.doStream as (o: StreamOptions) => ReturnType<M['doStream']>
        )(options);
        return {
          ...result,
          stream: guardStream(
            result.stream as unknown as ReadableStream<unknown>,
            deps,
            startedAt,
            acquired,
          ) as typeof result.stream,
        };
      } catch (cause) {
        sinkUsage(
          deps,
          failureStatus(cause),
          undefined,
          Date.now() - startedAt,
        );
        if (acquired) deps.releaseSlot();
        throw cause;
      }
    },
  } as unknown as M;
}

/**
 * 流式守卫（手动泵，回归审查 P2）：done / 读异常 / 消费方取消三种终态全部记账——
 * finish 块的 usage 记 success；错误块、异常、无 usage 终止如实记 failed；
 * 并发槽在每个终态恰好归还一次。透传全部 chunk，不改写流内容。
 */
function guardStream(
  inner: ReadableStream<unknown>,
  deps: MeteringDeps,
  startedAt: number,
  slotHeld: boolean,
): ReadableStream<unknown> {
  let captured: unknown;
  let sawFailure = false;
  let settled = false;
  let released = !slotHeld;
  const releaseOnce = () => {
    if (!released) {
      released = true;
      deps.releaseSlot();
    }
  };
  const reader = inner.getReader();
  return new ReadableStream<unknown>({
    async pull(controller) {
      if (settled) {
        controller.close();
        return;
      }
      try {
        const { done, value } = await reader.read();
        if (done) {
          settled = true;
          sinkUsage(
            deps,
            captured !== undefined && !sawFailure ? 'success' : 'failed',
            sawFailure ? undefined : captured,
            Date.now() - startedAt,
          );
          releaseOnce();
          controller.close();
          return;
        }
        if (value !== null && typeof value === 'object') {
          const part = value as { type?: string; usage?: unknown };
          if (part.type === 'finish') captured = part.usage;
          if (part.type === 'error' || part.type === 'abort') {
            sawFailure = true;
          }
        }
        controller.enqueue(value);
      } catch (cause) {
        settled = true;
        sinkUsage(deps, 'failed', undefined, Date.now() - startedAt);
        releaseOnce();
        controller.error(cause);
      }
    },
    async cancel(reason) {
      if (!settled) {
        settled = true;
        sinkUsage(deps, 'failed', undefined, Date.now() - startedAt);
      }
      releaseOnce();
      await reader.cancel(reason).catch(() => undefined);
    },
  });
}

function sinkUsage(
  deps: MeteringDeps,
  status: UsageStatusValue,
  usage: unknown,
  latencyMs: number,
): void {
  try {
    const tokens =
      status === 'success' ? normalizeTokens(usage) : emptyTokens();
    const context = currentCallContext();
    deps.enqueueUsage({
      ...tokens,
      latencyMs,
      status,
      caller: context.caller,
      traceId: context.traceId,
    });
  } catch {
    // 计量失败不阻断推理；入队失败由 QueueService 侧日志兜底
    return;
  }
}

/**
 * usage 双形态归一：
 * - V4 嵌套：inputTokens{total,cacheRead,cacheWrite} / outputTokens{total,reasoning}
 * - V2/V3 平铺：inputTokens/outputTokens/reasoningTokens/cachedInputTokens
 */
function normalizeTokens(usage: unknown): {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens: number;
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
      reasoningTokens: asCount(output?.reasoning),
      cachedInputTokens: asCount(input.cacheRead),
      cacheWriteTokens: asCount(input.cacheWrite),
    };
  }
  return {
    inputTokens: asCount(input),
    outputTokens: asCount(candidate.outputTokens),
    reasoningTokens: asCount(candidate.reasoningTokens),
    cachedInputTokens: asCount(candidate.cachedInputTokens),
    cacheWriteTokens: 0,
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
  noCache?: number | null;
}

interface UsageShapeNestedOutput {
  total?: number | null;
  text?: number | null;
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
  reasoningTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens: number;
} {
  return {
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    cachedInputTokens: 0,
    cacheWriteTokens: 0,
  };
}

/** 限流拒绝记 rate_limited（可观测命中率），其余失败记 failed。 */
function failureStatus(cause: unknown): UsageStatusValue {
  const isRateLimited =
    typeof cause === 'object' &&
    cause !== null &&
    (cause as { name?: string }).name === 'ModelRateLimitedError';
  return isRateLimited ? 'rate_limited' : 'failed';
}

export type { ModelRateLimitedError };
