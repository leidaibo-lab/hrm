/** 出站连续失败计数的 DI 令牌。 */
export const OUTBOUND_FAILURE_COUNTER = Symbol('OUTBOUND_FAILURE_COUNTER');

/**
 * 出站连续失败计数端口：发送成功清零，失败累加。
 * 达到阈值时由派发方暂停来源并告警。
 */
export interface OutboundFailureCounterPort {
  /** 失败计数 +1，返回累计值。 */
  increment(instanceId: string): Promise<number>;
  /** 发送成功时清零。 */
  reset(instanceId: string): Promise<void>;
}
