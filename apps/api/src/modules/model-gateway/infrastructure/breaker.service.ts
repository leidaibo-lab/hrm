/** 熔断参数：连续瞬时失败阈值与打开时长。 */
export interface BreakerOptions {
  /** 连续瞬时失败达到该值后打开。 */
  failureThreshold?: number;
  /** 首次打开的基准时长（毫秒）。 */
  baseOpenMs?: number;
  /** 指数退避的打开时长上限（毫秒）。 */
  maxOpenMs?: number;
}

interface BreakerState {
  failures: number;
  openUntil: number | null;
  probing: boolean;
}

/**
 * 进程内熔断器：closed → open → half-open。
 * 429 按 Retry-After 打开；瞬时错误连续达到阈值后指数退避打开；半开只放一个探针。
 */
export class CircuitBreaker {
  readonly #states = new Map<string, BreakerState>();
  readonly #failureThreshold: number;
  readonly #baseOpenMs: number;
  readonly #maxOpenMs: number;

  constructor(options: BreakerOptions = {}) {
    this.#failureThreshold = options.failureThreshold ?? 5;
    this.#baseOpenMs = options.baseOpenMs ?? 30_000;
    this.#maxOpenMs = options.maxOpenMs ?? 300_000;
  }

  allows(providerId: string, at: number): boolean {
    const state = this.state(providerId);
    if (state.openUntil === null) return true;
    if (at < state.openUntil) return false;
    if (state.probing) return false;
    state.probing = true;
    return true;
  }

  recordSuccess(providerId: string): void {
    this.#states.delete(providerId);
  }

  recordFailure(
    providerId: string,
    options: { retryable: boolean; retryAfterMs?: number; at: number },
  ): void {
    const state = this.state(providerId);
    state.probing = false;
    if (!options.retryable) return;
    state.failures += 1;
    if (options.retryAfterMs !== undefined) {
      state.openUntil = options.at + Math.max(0, options.retryAfterMs);
      return;
    }
    if (state.failures >= this.#failureThreshold) {
      const exponent = state.failures - this.#failureThreshold;
      state.openUntil = Math.min(
        options.at + this.#baseOpenMs * 2 ** exponent,
        options.at + this.#maxOpenMs,
      );
    }
  }

  /** 当前状态快照：测试与指标使用。 */
  snapshot(providerId: string): { failures: number; openUntil: number | null } {
    const state = this.state(providerId);
    return { failures: state.failures, openUntil: state.openUntil };
  }

  private state(providerId: string): BreakerState {
    const existing = this.#states.get(providerId);
    if (existing) return existing;
    const created: BreakerState = {
      failures: 0,
      openUntil: null,
      probing: false,
    };
    this.#states.set(providerId, created);
    return created;
  }
}
