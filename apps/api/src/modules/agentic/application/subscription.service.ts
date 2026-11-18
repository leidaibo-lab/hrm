import { Inject, Injectable } from '@nestjs/common';
import {
  Subscription,
  type SubscriptionReason,
} from '../domain/subscription.entity';
import {
  SUBSCRIPTION_REPOSITORY,
  type SubscriptionRepository,
} from '../domain/subscription.repository';

/** 订阅输入。 */
export interface SubscribeInput {
  /** 工单主键。 */
  ticketId: string;
  /** 线程主键。 */
  threadId: string;
  /** 订阅原因。 */
  reason: SubscriptionReason;
  /** 当前时间；缺省为系统时间。 */
  now?: Date;
}

/** 订阅用例：工单与线程的上下文扇出关系，不授予权限。 */
@Injectable()
export class SubscriptionService {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: SubscriptionRepository,
  ) {}

  /** 构造订阅实体；用于与接单写入同一事务。 */
  build(input: SubscribeInput): Subscription {
    return Subscription.create(input);
  }

  /** 新增订阅；重复由联合主键拒绝。 */
  async subscribe(input: SubscribeInput): Promise<Subscription> {
    const subscription = this.build(input);
    await this.subscriptions.add(subscription);
    return subscription;
  }

  /** 列出线程上的订阅。 */
  async listByThread(threadId: string): Promise<Subscription[]> {
    return this.subscriptions.listByThread(threadId);
  }

  /** 撤销工单对线程的订阅。 */
  async unsubscribe(ticketId: string, threadId: string): Promise<void> {
    await this.subscriptions.remove(ticketId, threadId);
  }
}
