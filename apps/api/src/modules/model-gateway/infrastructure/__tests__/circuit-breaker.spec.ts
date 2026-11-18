import { describe, expect, it } from 'vitest';
import { CircuitBreaker } from '../breaker.service';

describe('CircuitBreaker', () => {
  it('连续瞬时失败达到阈值后打开，到期后半开', () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      baseOpenMs: 1000,
    });
    breaker.recordFailure('provider', { retryable: true, at: 0 });
    expect(breaker.allows('provider', 10)).toBe(true);
    breaker.recordFailure('provider', { retryable: true, at: 20 });
    expect(breaker.allows('provider', 500)).toBe(false);
    expect(breaker.allows('provider', 1020)).toBe(true);
    expect(breaker.allows('provider', 1020)).toBe(false);
  });

  it('429 按 Retry-After 打开', () => {
    const breaker = new CircuitBreaker();
    breaker.recordFailure('provider', {
      retryable: true,
      retryAfterMs: 2000,
      at: 0,
    });
    expect(breaker.allows('provider', 1999)).toBe(false);
    expect(breaker.allows('provider', 2000)).toBe(true);
  });

  it('成功复位；不可重试失败不累计', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1 });
    breaker.recordFailure('provider', { retryable: false, at: 0 });
    expect(breaker.snapshot('provider').failures).toBe(0);
    breaker.recordFailure('provider', { retryable: true, at: 0 });
    expect(breaker.snapshot('provider').openUntil).not.toBeNull();
    breaker.recordSuccess('provider');
    expect(breaker.allows('provider', 0)).toBe(true);
  });
});
