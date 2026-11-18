/** 出站发送限速端口的 DI 令牌。 */
export const OUTBOUND_RATE_LIMIT = Symbol('OUTBOUND_RATE_LIMIT');

/**
 * 出站发送限速端口：按来源实例控制每秒发送数。
 * 返回 false 表示本轮配额已用尽，调用方应保留消息待下一轮。
 */
export interface OutboundRateLimitPort {
  /** 尝试获取该实例本秒的发送配额；Redis 不可用时 fail-open 放行。 */
  tryAcquire(instanceId: string): Promise<boolean>;
}
