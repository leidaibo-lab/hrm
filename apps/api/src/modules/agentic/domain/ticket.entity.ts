/** 工单类型：需求、缺陷、发布。 */
export type TicketKind = 'requirement' | 'bug' | 'release';

/** 工单状态：open 进行中，ended 已结束。 */
export type TicketStatus = 'open' | 'ended';

/** 工单快照：持久化后重建聚合。 */
export interface TicketSnapshot {
  /** 工单主键。 */
  id: string;
  /** 授权主键。 */
  mandateId: string;
  /** 所属线程主键。 */
  threadId: string;
  /** 项目或空间标识。 */
  scopeKey: string | null;
  /** 工单类型。 */
  kind: TicketKind;
  /** 工单状态。 */
  status: TicketStatus;
  /** 开启时间。 */
  openedAt: Date;
  /** 结束时间。 */
  endedAt: Date | null;
  /** 结束原因。 */
  endReason: string | null;
  /** 创建时间。 */
  createdAt: Date;
  /** 最近更新时间。 */
  updatedAt: Date;
}

/** 开启工单的输入。 */
export interface OpenTicketInput {
  /** 工单主键。 */
  id: string;
  /** 授权主键。 */
  mandateId: string;
  /** 所属线程主键。 */
  threadId: string;
  /** 项目或空间标识。 */
  scopeKey?: string | null;
  /** 工单类型。 */
  kind: TicketKind;
  /** 开启时间；缺省为当前时间。 */
  now?: Date;
}

/**
 * 工单聚合：被授权的工作单元。
 * 自有状态，不跟随执行器会话；结束可被人重新打开。
 */
export class Ticket {
  readonly #id: string;
  readonly #mandateId: string;
  readonly #threadId: string;
  readonly #scopeKey: string | null;
  readonly #kind: TicketKind;
  #status: TicketStatus;
  readonly #openedAt: Date;
  #endedAt: Date | null;
  #endReason: string | null;
  readonly #createdAt: Date;
  #updatedAt: Date;

  private constructor(snapshot: TicketSnapshot) {
    this.#id = snapshot.id;
    this.#mandateId = snapshot.mandateId;
    this.#threadId = snapshot.threadId;
    this.#scopeKey = snapshot.scopeKey;
    this.#kind = snapshot.kind;
    this.#status = snapshot.status;
    this.#openedAt = snapshot.openedAt;
    this.#endedAt = snapshot.endedAt;
    this.#endReason = snapshot.endReason;
    this.#createdAt = snapshot.createdAt;
    this.#updatedAt = snapshot.updatedAt;
  }

  /** 开启工单。 */
  static open(input: OpenTicketInput): Ticket {
    const now = input.now ?? new Date();
    return new Ticket({
      id: input.id,
      mandateId: input.mandateId,
      threadId: input.threadId,
      scopeKey: input.scopeKey ?? null,
      kind: input.kind,
      status: 'open',
      openedAt: now,
      endedAt: null,
      endReason: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** 从持久化快照重建。 */
  static rehydrate(snapshot: TicketSnapshot): Ticket {
    return new Ticket(snapshot);
  }

  /** 工单主键。 */
  get id(): string {
    return this.#id;
  }

  /** 授权主键。 */
  get mandateId(): string {
    return this.#mandateId;
  }

  /** 所属线程主键。 */
  get threadId(): string {
    return this.#threadId;
  }

  /** 项目或空间标识。 */
  get scopeKey(): string | null {
    return this.#scopeKey;
  }

  /** 工单类型。 */
  get kind(): TicketKind {
    return this.#kind;
  }

  /** 工单状态。 */
  get status(): TicketStatus {
    return this.#status;
  }

  /** 开启时间。 */
  get openedAt(): Date {
    return this.#openedAt;
  }

  /** 结束时间。 */
  get endedAt(): Date | null {
    return this.#endedAt;
  }

  /** 结束原因。 */
  get endReason(): string | null {
    return this.#endReason;
  }

  /** 创建时间。 */
  get createdAt(): Date {
    return this.#createdAt;
  }

  /** 最近更新时间。 */
  get updatedAt(): Date {
    return this.#updatedAt;
  }

  /** 是否进行中。 */
  get isOpen(): boolean {
    return this.#status === 'open';
  }

  /** 结束工单；重复结束幂等。 */
  end(reason: string, at: Date): void {
    if (this.#status === 'ended') return;
    const trimmed = reason.trim();
    if (!trimmed) throw new Error('结束原因不能为空');
    this.#status = 'ended';
    this.#endedAt = at;
    this.#endReason = trimmed;
    this.#updatedAt = at;
  }

  /** 重新打开；仅对已结束工单生效。 */
  reopen(at: Date): void {
    if (this.#status === 'open') return;
    this.#status = 'open';
    this.#endedAt = null;
    this.#endReason = null;
    this.#updatedAt = at;
  }

  /** 导出快照。 */
  toSnapshot(): TicketSnapshot {
    return {
      id: this.#id,
      mandateId: this.#mandateId,
      threadId: this.#threadId,
      scopeKey: this.#scopeKey,
      kind: this.#kind,
      status: this.#status,
      openedAt: this.#openedAt,
      endedAt: this.#endedAt,
      endReason: this.#endReason,
      createdAt: this.#createdAt,
      updatedAt: this.#updatedAt,
    };
  }
}
