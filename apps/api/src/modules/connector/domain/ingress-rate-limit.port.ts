/** 入站事件限速端口的 DI 令牌。 */
export const INGRESS_RATE_LIMIT = Symbol('INGRESS_RATE_LIMIT');

/**
 * 入站事件限速端口：按来源实例控制每秒接收事件数。
 * 返回 false 表示本秒配额用尽，调用方应拒绝本次接收并由来源重试。
 */
export interface IngressRateLimitPort {
  /** 尝试获取该实例本秒的接收配额；Redis 不可用时 fail-open 放行。 */
  tryAcquire(instanceId: string): Promise<boolean>;
}
