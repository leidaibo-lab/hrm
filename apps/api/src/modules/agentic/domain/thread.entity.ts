import { ThreadClosedError } from './domain.error';

/** 线程状态：open 接收事件，dormant 长期无事件，closed 人工关闭。 */
export type ThreadStatus = 'open' | 'dormant' | 'closed';

/** 线程快照：用于持久化后重建聚合。 */
export interface ThreadSnapshot {
  /** 线程主键。 */
  id: string;
  /** 来源类型（lark/zentao/gitlab）。 */
  sourceType: string;
  /** 来源内的稳定线程键。 */
  externalKey: string;
  /** 项目或空间标识；无项目来源为 null。 */
  scopeKey: string | null;
  /** 线程状态。 */
  status: ThreadStatus;
  /** 压缩后的上下文摘要。 */
  summary: string | null;
  /** 摘要版本，每次应用摘要自增。 */
  summaryVersion: number;
  /** 最近一次事件到达时间。 */
  lastEventAt: Date | null;
  /** 创建时间。 */
  createdAt: Date;
  /** 最近更新时间。 */
  updatedAt: Date;
}

/** 开启线程的输入。 */
export interface OpenThreadInput {
  /** 线程主键。 */
  id: string;
  /** 来源类型。 */
  sourceType: string;
  /** 来源内稳定线程键。 */
  externalKey: string;
  /** 项目或空间标识。 */
  scopeKey?: string | null;
  /** 开启时间；缺省为当前时间。 */
  now?: Date;
}

/**
 * 线程聚合：同一外部对象的连续事件流。
 * 只维护自身状态与摘要版本；事件与工单由应用层关联。
 */
export class Thread {
  readonly #id: string;
  readonly #sourceType: string;
  readonly #externalKey: string;
  readonly #scopeKey: string | null;
  #status: ThreadStatus;
  #summary: string | null;
  #summaryVersion: number;
  #lastEventAt: Date | null;
  readonly #createdAt: Date;
  #updatedAt: Date;

  private constructor(snapshot: ThreadSnapshot) {
    this.#id = snapshot.id;
    this.#sourceType = snapshot.sourceType;
    this.#externalKey = snapshot.externalKey;
    this.#scopeKey = snapshot.scopeKey;
    this.#status = snapshot.status;
    this.#summary = snapshot.summary;
    this.#summaryVersion = snapshot.summaryVersion;
    this.#lastEventAt = snapshot.lastEventAt;
    this.#createdAt = snapshot.createdAt;
    this.#updatedAt = snapshot.updatedAt;
  }

  /** 开启一个新线程。 */
  static open(input: OpenThreadInput): Thread {
    const now = input.now ?? new Date();
    return new Thread({
      id: input.id,
      sourceType: input.sourceType,
      externalKey: input.externalKey,
      scopeKey: input.scopeKey ?? null,
      status: 'open',
      summary: null,
      summaryVersion: 0,
      lastEventAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** 从持久化快照重建。 */
  static rehydrate(snapshot: ThreadSnapshot): Thread {
    return new Thread(snapshot);
  }

  /** 线程主键。 */
  get id(): string {
    return this.#id;
  }

  /** 来源类型。 */
  get sourceType(): string {
    return this.#sourceType;
  }

  /** 来源内稳定线程键。 */
  get externalKey(): string {
    return this.#externalKey;
  }

  /** 项目或空间标识。 */
  get scopeKey(): string | null {
    return this.#scopeKey;
  }

  /** 线程状态。 */
  get status(): ThreadStatus {
    return this.#status;
  }

  /** 当前摘要。 */
  get summary(): string | null {
    return this.#summary;
  }

  /** 摘要版本。 */
  get summaryVersion(): number {
    return this.#summaryVersion;
  }

  /** 最近事件时间。 */
  get lastEventAt(): Date | null {
    return this.#lastEventAt;
  }

  /** 创建时间。 */
  get createdAt(): Date {
    return this.#createdAt;
  }

  /** 最近更新时间。 */
  get updatedAt(): Date {
    return this.#updatedAt;
  }

  /** 是否仍接收事件。 */
  get isOpen(): boolean {
    return this.#status !== 'closed';
  }

  /** 记录一次事件到达；早于当前记录的时间不覆盖。 */
  touch(at: Date): void {
    this.ensureOpen();
    if (this.#lastEventAt && at < this.#lastEventAt) return;
    this.#lastEventAt = at;
    this.#updatedAt = at;
  }

  /** 应用一次摘要更新，版本自增。 */
  applySummary(summary: string, at: Date): void {
    this.ensureOpen();
    const trimmed = summary.trim();
    if (!trimmed) throw new Error('摘要不能为空');
    this.#summary = trimmed;
    this.#summaryVersion += 1;
    this.#updatedAt = at;
  }

  /** 标记为休眠：长期无事件但保留恢复能力。 */
  markDormant(at: Date): void {
    this.ensureOpen();
    if (this.#status === 'dormant') return;
    this.#status = 'dormant';
    this.#updatedAt = at;
  }

  /** 从休眠恢复为 open。 */
  markActive(at: Date): void {
    this.ensureOpen();
    if (this.#status === 'open') return;
    this.#status = 'open';
    this.#updatedAt = at;
  }

  /** 关闭线程；重复关闭幂等。 */
  close(at: Date): void {
    if (this.#status === 'closed') return;
    this.#status = 'closed';
    this.#updatedAt = at;
  }

  /** 导出快照。 */
  toSnapshot(): ThreadSnapshot {
    return {
      id: this.#id,
      sourceType: this.#sourceType,
      externalKey: this.#externalKey,
      scopeKey: this.#scopeKey,
      status: this.#status,
      summary: this.#summary,
      summaryVersion: this.#summaryVersion,
      lastEventAt: this.#lastEventAt,
      createdAt: this.#createdAt,
      updatedAt: this.#updatedAt,
    };
  }

  private ensureOpen(): void {
    if (this.#status === 'closed') throw new ThreadClosedError(this.#id);
  }
}
