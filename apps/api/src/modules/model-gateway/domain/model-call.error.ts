import { type ErrorCode } from '@cip/shared';

/** 一次候选尝试的失败摘要：用于聚合错误与排障。 */
export interface ModelCallAttempt {
  /** 候选项标识。 */
  candidateId: string;
  /** 业务编码。 */
  code: ErrorCode;
  /** 是否允许重试。 */
  isRetryable: boolean;
  /** 发生时间。 */
  at: number;
}

/**
 * 模型调用失败：携带业务错误码、可重试语义与全部候选尝试。
 * 主错误码在抛出前由调用方按「首个永久错误优先」确定。
 */
export class ModelCallError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly isRetryable: boolean,
    readonly retryAfterMs?: number,
    readonly attempts: readonly ModelCallAttempt[] = [],
  ) {
    super(message);
    this.name = 'ModelCallError';
  }
}

/** 尝试序列的主错误：首个永久错误；否则最后一条。 */
export function primaryAttempt(
  attempts: readonly ModelCallAttempt[],
): ModelCallAttempt | undefined {
  const permanent = attempts.find(
    (attempt) => !attempt.isRetryable && attempt.code !== 'model.rate_limited',
  );
  return permanent ?? attempts.at(-1);
}
