/** 订阅原因：工单开启、拉取请求、补充上下文。 */
export type SubscriptionReason = 'started' | 'pull_request' | 'context';

/** 订阅快照：工单与线程的多对多关系。 */
export interface SubscriptionSnapshot {
  /** 工单主键。 */
  ticketId: string;
  /** 线程主键。 */
  threadId: string;
  /** 订阅原因。 */
  reason: SubscriptionReason;
  /** 订阅时间。 */
  createdAt: Date;
}

/** 创建订阅的输入。 */
export interface CreateSubscriptionInput {
  /** 工单主键。 */
  ticketId: string;
  /** 线程主键。 */
  threadId: string;
  /** 订阅原因。 */
  reason: SubscriptionReason;
  /** 订阅时间；缺省为当前时间。 */
  now?: Date;
}

/**
 * 订阅聚合：工单订阅线程，只用于上下文扇出，不授予任何权限。
 */
export class Subscription {
  readonly #ticketId: string;
  readonly #threadId: string;
  readonly #reason: SubscriptionReason;
  readonly #createdAt: Date;

  private constructor(snapshot: SubscriptionSnapshot) {
    this.#ticketId = snapshot.ticketId;
    this.#threadId = snapshot.threadId;
    this.#reason = snapshot.reason;
    this.#createdAt = snapshot.createdAt;
  }

  /** 创建订阅。 */
  static create(input: CreateSubscriptionInput): Subscription {
    if (!input.ticketId.trim()) throw new Error('订阅工单不能为空');
    if (!input.threadId.trim()) throw new Error('订阅线程不能为空');
    return new Subscription({
      ticketId: input.ticketId,
      threadId: input.threadId,
      reason: input.reason,
      createdAt: input.now ?? new Date(),
    });
  }

  /** 从持久化快照重建。 */
  static rehydrate(snapshot: SubscriptionSnapshot): Subscription {
    return new Subscription(snapshot);
  }

  /** 工单主键。 */
  get ticketId(): string {
    return this.#ticketId;
  }

  /** 线程主键。 */
  get threadId(): string {
    return this.#threadId;
  }

  /** 订阅原因。 */
  get reason(): SubscriptionReason {
    return this.#reason;
  }

  /** 订阅时间。 */
  get createdAt(): Date {
    return this.#createdAt;
  }

  /** 导出快照。 */
  toSnapshot(): SubscriptionSnapshot {
    return {
      ticketId: this.#ticketId,
      threadId: this.#threadId,
      reason: this.#reason,
      createdAt: this.#createdAt,
    };
  }
}
