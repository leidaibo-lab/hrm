/** 派发状态：待执行、执行中、已结束。 */
export type AssignmentStatus = 'pending' | 'running' | 'ended';

/** 派发快照。 */
export interface AssignmentSnapshot {
  /** 派发主键。 */
  id: string;
  /** 所属工单主键。 */
  ticketId: string;
  /** 状态。 */
  status: AssignmentStatus;
  /** 尝试序号。 */
  attempt: number;
  /** 执行器运行标识。 */
  executorRunId: string | null;
  /** 开始时间。 */
  startedAt: Date | null;
  /** 结束时间。 */
  endedAt: Date | null;
  /** 结束错误。 */
  error: string | null;
  /** 创建时间。 */
  createdAt: Date;
  /** 最近更新时间。 */
  updatedAt: Date;
}

/** 创建派发的输入。 */
export interface CreateAssignmentInput {
  /** 派发主键。 */
  id: string;
  /** 所属工单主键。 */
  ticketId: string;
  /** 尝试序号。 */
  attempt?: number;
  /** 创建时间；缺省为当前时间。 */
  now?: Date;
}

/** 派发聚合：工单与执行器的一次绑定。 */
export class Assignment {
  readonly #id: string;
  readonly #ticketId: string;
  #status: AssignmentStatus;
  readonly #attempt: number;
  #executorRunId: string | null;
  #startedAt: Date | null;
  #endedAt: Date | null;
  #error: string | null;
  readonly #createdAt: Date;
  #updatedAt: Date;

  private constructor(snapshot: AssignmentSnapshot) {
    this.#id = snapshot.id;
    this.#ticketId = snapshot.ticketId;
    this.#status = snapshot.status;
    this.#attempt = snapshot.attempt;
    this.#executorRunId = snapshot.executorRunId;
    this.#startedAt = snapshot.startedAt;
    this.#endedAt = snapshot.endedAt;
    this.#error = snapshot.error;
    this.#createdAt = snapshot.createdAt;
    this.#updatedAt = snapshot.updatedAt;
  }

  /** 创建待执行派发。 */
  static create(input: CreateAssignmentInput): Assignment {
    const attempt = input.attempt ?? 1;
    if (attempt < 1) throw new Error('尝试序号必须为正整数');
    const now = input.now ?? new Date();
    return new Assignment({
      id: input.id,
      ticketId: input.ticketId,
      status: 'pending',
      attempt,
      executorRunId: null,
      startedAt: null,
      endedAt: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** 从持久化快照重建。 */
  static rehydrate(snapshot: AssignmentSnapshot): Assignment {
    return new Assignment(snapshot);
  }

  /** 派发主键。 */
  get id(): string {
    return this.#id;
  }

  /** 所属工单主键。 */
  get ticketId(): string {
    return this.#ticketId;
  }

  /** 状态。 */
  get status(): AssignmentStatus {
    return this.#status;
  }

  /** 尝试序号。 */
  get attempt(): number {
    return this.#attempt;
  }

  /** 执行器运行标识。 */
  get executorRunId(): string | null {
    return this.#executorRunId;
  }

  /** 开始时间。 */
  get startedAt(): Date | null {
    return this.#startedAt;
  }

  /** 结束时间。 */
  get endedAt(): Date | null {
    return this.#endedAt;
  }

  /** 结束错误。 */
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

  /** 是否已结束。 */
  get isEnded(): boolean {
    return this.#status === 'ended';
  }

  /** 开始执行；同一运行重复开始幂等。 */
  start(executorRunId: string, at: Date): void {
    if (!executorRunId.trim()) throw new Error('执行器运行标识不能为空');
    if (this.#status === 'ended') throw new Error('派发已结束，不能重新开始');
    if (this.#status === 'running') {
      if (this.#executorRunId === executorRunId) return;
      throw new Error('派发已在其他运行中执行');
    }
    this.#status = 'running';
    this.#executorRunId = executorRunId;
    this.#startedAt = at;
    this.#updatedAt = at;
  }

  /** 结束派发；重复结束幂等。 */
  end(at: Date, error?: string | null): void {
    if (this.#status === 'ended') return;
    this.#status = 'ended';
    this.#endedAt = at;
    this.#error = error ?? null;
    this.#updatedAt = at;
  }

  /** 导出快照。 */
  toSnapshot(): AssignmentSnapshot {
    return {
      id: this.#id,
      ticketId: this.#ticketId,
      status: this.#status,
      attempt: this.#attempt,
      executorRunId: this.#executorRunId,
      startedAt: this.#startedAt,
      endedAt: this.#endedAt,
      error: this.#error,
      createdAt: this.#createdAt,
      updatedAt: this.#updatedAt,
    };
  }
}
