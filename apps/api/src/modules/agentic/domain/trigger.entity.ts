import { TriggerAlreadyDisposedError } from './domain.error';

/** 事件处置状态：pending 待处理，其余为终态。 */
export type TriggerDisposition =
  | 'pending'
  | 'filtered'
  | 'evaluated'
  | 'fanned_out';

/** 事件是否点名机器人。 */
export type Addressed = 'mention' | 'direct';

/** 事件快照：持久化后重建聚合。 */
export interface TriggerSnapshot {
  /** 事件主键。 */
  id: string;
  /** 幂等键，来源内稳定。 */
  dedupeKey: string;
  /** 来源类型。 */
  sourceType: string;
  /** 源实例主键。 */
  instanceId: string;
  /** 所属线程主键。 */
  threadId: string;
  /** 项目或空间标识。 */
  scopeKey: string | null;
  /** 源内操作者标识。 */
  actorId: string;
  /** 平台用户标识；未映射时为 null。 */
  actorUserId: string | null;
  /** 是否点名机器人。 */
  addressed: Addressed | null;
  /** 事件文本。 */
  text: string;
  /** 原始负载，结构由来源 schema 约束。 */
  payload: unknown;
  /** 负载结构版本。 */
  payloadVersion: number;
  /** 事件发生时间。 */
  occurredAt: Date;
  /** 平台接收时间。 */
  receivedAt: Date;
  /** 处置状态。 */
  disposition: TriggerDisposition;
  /** 处置时间。 */
  disposedAt: Date | null;
  /** 过滤原因；仅 filtered 时有值。 */
  filterReason: string | null;
}

/** 创建事件的输入。 */
export interface CreateTriggerInput {
  /** 事件主键。 */
  id: string;
  /** 幂等键。 */
  dedupeKey: string;
  /** 来源类型。 */
  sourceType: string;
  /** 源实例主键。 */
  instanceId: string;
  /** 所属线程主键。 */
  threadId: string;
  /** 项目或空间标识。 */
  scopeKey?: string | null;
  /** 源内操作者标识。 */
  actorId: string;
  /** 平台用户标识。 */
  actorUserId?: string | null;
  /** 是否点名机器人。 */
  addressed?: Addressed | null;
  /** 事件文本。 */
  text: string;
  /** 原始负载。 */
  payload: unknown;
  /** 事件发生时间。 */
  occurredAt: Date;
  /** 平台接收时间；缺省为当前时间。 */
  receivedAt?: Date;
}

/**
 * 事件聚合：不可变的外部事件，只允许处置状态迁移一次。
 * 幂等键由来源生成，重复投递由仓储唯一约束兜底。
 */
export class Trigger {
  readonly #id: string;
  readonly #dedupeKey: string;
  readonly #sourceType: string;
  readonly #instanceId: string;
  readonly #threadId: string;
  readonly #scopeKey: string | null;
  readonly #actorId: string;
  readonly #actorUserId: string | null;
  readonly #addressed: Addressed | null;
  readonly #text: string;
  readonly #payload: unknown;
  readonly #payloadVersion: number;
  readonly #occurredAt: Date;
  readonly #receivedAt: Date;
  #disposition: TriggerDisposition;
  #disposedAt: Date | null;
  #filterReason: string | null;

  private constructor(snapshot: TriggerSnapshot) {
    this.#id = snapshot.id;
    this.#dedupeKey = snapshot.dedupeKey;
    this.#sourceType = snapshot.sourceType;
    this.#instanceId = snapshot.instanceId;
    this.#threadId = snapshot.threadId;
    this.#scopeKey = snapshot.scopeKey;
    this.#actorId = snapshot.actorId;
    this.#actorUserId = snapshot.actorUserId;
    this.#addressed = snapshot.addressed;
    this.#text = snapshot.text;
    this.#payload = snapshot.payload;
    this.#payloadVersion = snapshot.payloadVersion;
    this.#occurredAt = snapshot.occurredAt;
    this.#receivedAt = snapshot.receivedAt;
    this.#disposition = snapshot.disposition;
    this.#disposedAt = snapshot.disposedAt;
    this.#filterReason = snapshot.filterReason;
  }

  /** 创建一条待处理事件。 */
  static create(input: CreateTriggerInput): Trigger {
    return new Trigger({
      id: input.id,
      dedupeKey: input.dedupeKey,
      sourceType: input.sourceType,
      instanceId: input.instanceId,
      threadId: input.threadId,
      scopeKey: input.scopeKey ?? null,
      actorId: input.actorId,
      actorUserId: input.actorUserId ?? null,
      addressed: input.addressed ?? null,
      text: input.text,
      payload: input.payload,
      payloadVersion: 1,
      occurredAt: input.occurredAt,
      receivedAt: input.receivedAt ?? new Date(),
      disposition: 'pending',
      disposedAt: null,
      filterReason: null,
    });
  }

  /** 从持久化快照重建。 */
  static rehydrate(snapshot: TriggerSnapshot): Trigger {
    return new Trigger(snapshot);
  }

  /** 事件主键。 */
  get id(): string {
    return this.#id;
  }

  /** 幂等键。 */
  get dedupeKey(): string {
    return this.#dedupeKey;
  }

  /** 来源类型。 */
  get sourceType(): string {
    return this.#sourceType;
  }

  /** 源实例主键。 */
  get instanceId(): string {
    return this.#instanceId;
  }

  /** 所属线程主键。 */
  get threadId(): string {
    return this.#threadId;
  }

  /** 项目或空间标识。 */
  get scopeKey(): string | null {
    return this.#scopeKey;
  }

  /** 源内操作者标识。 */
  get actorId(): string {
    return this.#actorId;
  }

  /** 平台用户标识。 */
  get actorUserId(): string | null {
    return this.#actorUserId;
  }

  /** 是否点名机器人。 */
  get addressed(): Addressed | null {
    return this.#addressed;
  }

  /** 事件文本。 */
  get text(): string {
    return this.#text;
  }

  /** 原始负载。 */
  get payload(): unknown {
    return this.#payload;
  }

  /** 负载结构版本。 */
  get payloadVersion(): number {
    return this.#payloadVersion;
  }

  /** 事件发生时间。 */
  get occurredAt(): Date {
    return this.#occurredAt;
  }

  /** 平台接收时间。 */
  get receivedAt(): Date {
    return this.#receivedAt;
  }

  /** 处置状态。 */
  get disposition(): TriggerDisposition {
    return this.#disposition;
  }

  /** 处置时间。 */
  get disposedAt(): Date | null {
    return this.#disposedAt;
  }

  /** 过滤原因。 */
  get filterReason(): string | null {
    return this.#filterReason;
  }

  /** 是否仍待处理。 */
  get isPending(): boolean {
    return this.#disposition === 'pending';
  }

  /** 标记为被过滤，并保留判定原因。 */
  markFiltered(at: Date, reason?: string): void {
    this.dispose('filtered', at);
    this.#filterReason = reason?.trim() || null;
  }

  /** 标记为已研判。 */
  markEvaluated(at: Date): void {
    this.dispose('evaluated', at);
  }

  /** 标记为已扇出。 */
  markFannedOut(at: Date): void {
    this.dispose('fanned_out', at);
  }

  /** 导出快照。 */
  toSnapshot(): TriggerSnapshot {
    return {
      id: this.#id,
      dedupeKey: this.#dedupeKey,
      sourceType: this.#sourceType,
      instanceId: this.#instanceId,
      threadId: this.#threadId,
      scopeKey: this.#scopeKey,
      actorId: this.#actorId,
      actorUserId: this.#actorUserId,
      addressed: this.#addressed,
      text: this.#text,
      payload: this.#payload,
      payloadVersion: this.#payloadVersion,
      occurredAt: this.#occurredAt,
      receivedAt: this.#receivedAt,
      disposition: this.#disposition,
      disposedAt: this.#disposedAt,
      filterReason: this.#filterReason,
    };
  }

  private dispose(next: TriggerDisposition, at: Date): void {
    if (this.#disposition !== 'pending')
      throw new TriggerAlreadyDisposedError(this.#id, this.#disposition);
    this.#disposition = next;
    this.#disposedAt = at;
  }
}
