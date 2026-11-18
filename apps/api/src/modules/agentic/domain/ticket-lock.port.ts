/** 工单级互斥锁的 DI 令牌。 */
export const TICKET_LOCK = Symbol('TICKET_LOCK');

/** 锁句柄：释放幂等。 */
export interface TicketLockHandle {
  /** 释放锁；重复调用无副作用。 */
  release(): Promise<void>;
}

/**
 * 工单级互斥锁端口：回答与闸门推进跨副本串行。
 * acquire 返回 null 表示锁被占用；Redis 不可用时返回 no-op 句柄（fail-open）。
 */
export interface TicketLockPort {
  /** 尝试获取工单锁，TTL 由实现决定。 */
  acquire(ticketId: string): Promise<TicketLockHandle | null>;
}
