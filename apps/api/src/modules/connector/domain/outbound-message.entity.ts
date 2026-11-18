/** 出站状态：待发、已发、永久失败。 */
export type OutboundStatus = 'pending' | 'sent' | 'gone';

/** 出站消息快照。 */
export interface OutboundMessageSnapshot {
  /** 消息主键。 */
  id: string;
  /** 来源实例主键。 */
  instanceId: string;
  /** 目标地址主键。 */
  targetId: string | null;
  /** 地址负载。 */
  address: unknown;
  /** 消息负载。 */
  payload: unknown;
  /** 幂等键。 */
  idempotencyKey: string;
  /** 状态。 */
  status: OutboundStatus;
  /** 已尝试次数。 */
  attempts: number;
  /** 下次重试时间。 */
  nextAttemptAt: Date | null;
  /** 发送成功时间。 */
  sentAt: Date | null;
  /** 最近错误。 */
  error: string | null;
  /** 创建时间。 */
  createdAt: Date;
  /** 最近更新时间。 */
  updatedAt: Date;
}

/** 创建出站消息的输入。 */
export interface CreateOutboundMessageInput {
  /** 消息主键。 */
  id: string;
  /** 来源实例主键。 */
  instanceId: string;
  /** 目标地址主键。 */
  targetId?: string | null;
  /** 地址负载。 */
  address: unknown;
  /** 消息负载。 */
  payload: unknown;
  /** 幂等键。 */
  idempotencyKey: string;
  /** 创建时间；缺省为当前时间。 */
  now?: Date;
}

/** 出站消息聚合：幂等入队、失败退避、永久失败终止。 */
export class OutboundMessage {
  readonly #id: string;
  readonly #instanceId: string;
  readonly #targetId: string | null;
  readonly #address: unknown;
  readonly #payload: unknown;
  readonly #idempotencyKey: string;
  #status: OutboundStatus;
  #attempts: number;
  #nextAttemptAt: Date | null;
  #sentAt: Date | null;
  #error: string | null;
  readonly #createdAt: Date;
  #updatedAt: Date;

  private constructor(snapshot: OutboundMessageSnapshot) {
    this.#id = snapshot.id;
    this.#instanceId = snapshot.instanceId;
    this.#targetId = snapshot.targetId;
    this.#address = snapshot.address;
    this.#payload = snapshot.payload;
    this.#idempotencyKey = snapshot.idempotencyKey;
    this.#status = snapshot.status;
    this.#attempts = snapshot.attempts;
    this.#nextAttemptAt = snapshot.nextAttemptAt;
    this.#sentAt = snapshot.sentAt;
    this.#error = snapshot.error;
    this.#createdAt = snapshot.createdAt;
    this.#updatedAt = snapshot.updatedAt;
  }

  /** 创建待发消息。 */
  static create(input: CreateOutboundMessageInput): OutboundMessage {
    if (!input.idempotencyKey.trim()) throw new Error('出站幂等键不能为空');
    if (input.address === null || input.address === undefined)
      throw new Error('出站地址不能为空');
    if (input.payload === null || input.payload === undefined)
      throw new Error('出站负载不能为空');
    const now = input.now ?? new Date();
    return new OutboundMessage({
      id: input.id,
      instanceId: input.instanceId,
      targetId: input.targetId ?? null,
      address: input.address,
      payload: input.payload,
      idempotencyKey: input.idempotencyKey,
      status: 'pending',
      attempts: 0,
      nextAttemptAt: null,
      sentAt: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** 从持久化快照重建。 */
  static rehydrate(snapshot: OutboundMessageSnapshot): OutboundMessage {
    return new OutboundMessage(snapshot);
  }

  /** 消息主键。 */
  get id(): string {
    return this.#id;
  }

  /** 来源实例主键。 */
  get instanceId(): string {
    return this.#instanceId;
  }

  /** 目标地址主键。 */
  get targetId(): string | null {
    return this.#targetId;
  }

  /** 地址负载。 */
  get address(): unknown {
    return this.#address;
  }

  /** 消息负载。 */
  get payload(): unknown {
    return this.#payload;
  }

  /** 幂等键。 */
  get idempotencyKey(): string {
    return this.#idempotencyKey;
  }

  /** 状态。 */
  get status(): OutboundStatus {
    return this.#status;
  }

  /** 已尝试次数。 */
  get attempts(): number {
    return this.#attempts;
  }

  /** 下次重试时间。 */
  get nextAttemptAt(): Date | null {
    return this.#nextAttemptAt;
  }

  /** 发送成功时间。 */
  get sentAt(): Date | null {
    return this.#sentAt;
  }

  /** 最近错误。 */
  get error(): string | null {
    return this.#error;
  }

  /** 创建时间。 */
  get createdAt(): Date {
    return this.#createdAt;
  }

  /** 最近更新时间。 */
  get updatedAt(): Date {
    return this.#updatedAt;
  }

  /** 是否到期待发。 */
  isDue(at: Date): boolean {
    if (this.#status !== 'pending') return false;
    return !this.#nextAttemptAt || this.#nextAttemptAt <= at;
  }

  /** 标记发送成功。 */
  markSent(at: Date): void {
    this.#status = 'sent';
    this.#sentAt = at;
    this.#nextAttemptAt = null;
    this.#error = null;
    this.#updatedAt = at;
  }

  /** 标记永久失败。 */
  markGone(error: string, at: Date): void {
    this.#status = 'gone';
    this.#nextAttemptAt = null;
    this.#error = error;
    this.#updatedAt = at;
  }

  /** 记录一次可重试失败。 */
  markFailure(error: string, nextAttemptAt: Date, at: Date): void {
    this.#attempts += 1;
    this.#error = error;
    this.#nextAttemptAt = nextAttemptAt;
    this.#updatedAt = at;
  }

  /** 导出快照。 */
  toSnapshot(): OutboundMessageSnapshot {
    return {
      id: this.#id,
      instanceId: this.#instanceId,
      targetId: this.#targetId,
      address: this.#address,
      payload: this.#payload,
      idempotencyKey: this.#idempotencyKey,
      status: this.#status,
      attempts: this.#attempts,
      nextAttemptAt: this.#nextAttemptAt,
      sentAt: this.#sentAt,
      error: this.#error,
      createdAt: this.#createdAt,
      updatedAt: this.#updatedAt,
    };
  }
}
