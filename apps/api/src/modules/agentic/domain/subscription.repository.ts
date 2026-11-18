import type { Subscription } from './subscription.entity';

/** 订阅仓储的 DI 令牌。 */
export const SUBSCRIPTION_REPOSITORY = Symbol('SUBSCRIPTION_REPOSITORY');

/** 订阅仓储端口：按线程扇出，按工单撤销。 */
export interface SubscriptionRepository {
  /** 列出线程上的全部订阅。 */
  listByThread(threadId: string): Promise<Subscription[]>;
  /** 列出工单的全部订阅。 */
  listByTicket(ticketId: string): Promise<Subscription[]>;
  /** 新增订阅；重复由联合主键拒绝。 */
  add(subscription: Subscription): Promise<void>;
  /** 撤销某工单对某线程的订阅。 */
  remove(ticketId: string, threadId: string): Promise<void>;
}
