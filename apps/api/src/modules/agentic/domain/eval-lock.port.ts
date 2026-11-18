/** 线程级 Eval 互斥锁的 DI 令牌。 */
export const EVAL_LOCK = Symbol('EVAL_LOCK');

/** 锁句柄：释放幂等。 */
export interface EvalLockHandle {
  /** 释放锁；重复调用无副作用。 */
  release(): Promise<void>;
}

/**
 * 线程级 Eval 互斥端口：同一 Thread 同时只允许一个 Eval（I4）。
 * tryAcquire 返回 null 表示被占用；Redis 不可用时返回 no-op（fail-open）。
 */
export interface EvalLockPort {
  /** 尝试获取线程锁；TTL 由实现决定。 */
  tryAcquire(threadId: string): Promise<EvalLockHandle | null>;
}
