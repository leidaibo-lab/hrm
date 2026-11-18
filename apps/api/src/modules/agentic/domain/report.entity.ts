/** 回报类型：进展、等待、就绪、受阻、失败。 */
export type ReportKind =
  | 'progress'
  | 'waiting'
  | 'ready'
  | 'blocked'
  | 'failed';

/** 回报快照。 */
export interface ReportSnapshot {
  /** 回报主键。 */
  id: string;
  /** 所属派发主键。 */
  assignmentId: string;
  /** 回报类型。 */
  kind: ReportKind;
  /** 回报负载。 */
  payload: unknown;
  /** 创建时间。 */
  createdAt: Date;
}

/** 创建回报的输入。 */
export interface CreateReportInput {
  /** 回报主键。 */
  id: string;
  /** 所属派发主键。 */
  assignmentId: string;
  /** 回报类型。 */
  kind: ReportKind;
  /** 回报负载。 */
  payload: unknown;
  /** 创建时间；缺省为当前时间。 */
  now?: Date;
}

/** 回报聚合：只追加的执行回报。 */
export class Report {
  readonly #id: string;
  readonly #assignmentId: string;
  readonly #kind: ReportKind;
  readonly #payload: unknown;
  readonly #createdAt: Date;

  private constructor(snapshot: ReportSnapshot) {
    this.#id = snapshot.id;
    this.#assignmentId = snapshot.assignmentId;
    this.#kind = snapshot.kind;
    this.#payload = snapshot.payload;
    this.#createdAt = snapshot.createdAt;
  }

  /** 创建回报。 */
  static create(input: CreateReportInput): Report {
    if (!input.assignmentId.trim()) throw new Error('回报派发不能为空');
    if (input.payload === null || input.payload === undefined)
      throw new Error('回报负载不能为空');
    return new Report({
      id: input.id,
      assignmentId: input.assignmentId,
      kind: input.kind,
      payload: input.payload,
      createdAt: input.now ?? new Date(),
    });
  }

  /** 从持久化快照重建。 */
  static rehydrate(snapshot: ReportSnapshot): Report {
    return new Report(snapshot);
  }

  /** 回报主键。 */
  get id(): string {
    return this.#id;
  }

  /** 所属派发主键。 */
  get assignmentId(): string {
    return this.#assignmentId;
  }

  /** 回报类型。 */
  get kind(): ReportKind {
    return this.#kind;
  }

  /** 回报负载。 */
  get payload(): unknown {
    return this.#payload;
  }

  /** 创建时间。 */
  get createdAt(): Date {
    return this.#createdAt;
  }

  /** 导出快照。 */
  toSnapshot(): ReportSnapshot {
    return {
      id: this.#id,
      assignmentId: this.#assignmentId,
      kind: this.#kind,
      payload: this.#payload,
      createdAt: this.#createdAt,
    };
  }
}
