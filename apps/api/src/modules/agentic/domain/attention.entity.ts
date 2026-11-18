import { AttentionStateError } from './attention.error';

/** 关注类型：确认、澄清、评审、审批。 */
export type AttentionKind = 'confirm' | 'clarify' | 'review' | 'approval';

/** 关注状态：待答、已回答、已过期。 */
export type AttentionStatus = 'open' | 'answered' | 'expired';

/** 关注快照。 */
export interface AttentionSnapshot {
  /** 关注主键。 */
  id: string;
  /** 所属工单主键。 */
  ticketId: string;
  /** 关注类型。 */
  kind: AttentionKind;
  /** 问题文本。 */
  question: string;
  /** 可选答案。 */
  options: unknown[] | null;
  /** 状态。 */
  status: AttentionStatus;
  /** 截止时间。 */
  deadline: Date;
  /** 等待对象：应回答问题的人（授权发起人、升级负责人或追问人）。 */
  assignee: string;
  /** 决定人。 */
  decidedBy: string | null;
  /** 决定时间。 */
  decidedAt: Date | null;
  /** 答案负载。 */
  answer: unknown;
  /** 创建时间。 */
  createdAt: Date;
  /** 最近更新时间。 */
  updatedAt: Date;
}

/** 创建关注的输入。 */
export interface CreateAttentionInput {
  /** 关注主键。 */
  id: string;
  /** 所属工单主键。 */
  ticketId: string;
  /** 关注类型。 */
  kind: AttentionKind;
  /** 问题文本。 */
  question: string;
  /** 可选答案。 */
  options?: unknown[] | null;
  /** 截止时间；必须是合法时间。 */
  deadline: Date;
  /** 等待对象：应回答问题的人；必须非空。 */
  assignee: string;
  /** 创建时间；缺省为当前时间。 */
  now?: Date;
}

/** 关注聚合：需要人回答的问题，独立于执行器会话。 */
export class Attention {
  readonly #id: string;
  readonly #ticketId: string;
  readonly #kind: AttentionKind;
  readonly #question: string;
  readonly #options: unknown[] | null;
  #status: AttentionStatus;
  readonly #deadline: Date;
  readonly #assignee: string;
  #decidedBy: string | null;
  #decidedAt: Date | null;
  #answer: unknown;
  readonly #createdAt: Date;
  #updatedAt: Date;

  private constructor(snapshot: AttentionSnapshot) {
    this.#id = snapshot.id;
    this.#ticketId = snapshot.ticketId;
    this.#kind = snapshot.kind;
    this.#question = snapshot.question;
    this.#options = snapshot.options;
    this.#status = snapshot.status;
    this.#deadline = snapshot.deadline;
    this.#assignee = snapshot.assignee;
    this.#decidedBy = snapshot.decidedBy;
    this.#decidedAt = snapshot.decidedAt;
    this.#answer = snapshot.answer;
    this.#createdAt = snapshot.createdAt;
    this.#updatedAt = snapshot.updatedAt;
  }

  /** 创建待答关注。 */
  static create(input: CreateAttentionInput): Attention {
    if (!input.question.trim()) throw new Error('关注问题不能为空');
    const assignee = input.assignee.trim();
    if (!assignee) throw new Error('关注必须有等待对象');
    if (
      !(input.deadline instanceof Date) ||
      Number.isNaN(input.deadline.getTime())
    )
      throw new Error('关注必须有合法时限');
    const now = input.now ?? new Date();
    return new Attention({
      id: input.id,
      ticketId: input.ticketId,
      kind: input.kind,
      question: input.question,
      options: input.options ?? null,
      status: 'open',
      deadline: input.deadline,
      assignee,
      decidedBy: null,
      decidedAt: null,
      answer: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** 从持久化快照重建。 */
  static rehydrate(snapshot: AttentionSnapshot): Attention {
    return new Attention(snapshot);
  }

  /** 关注主键。 */
  get id(): string {
    return this.#id;
  }

  /** 所属工单主键。 */
  get ticketId(): string {
    return this.#ticketId;
  }

  /** 关注类型。 */
  get kind(): AttentionKind {
    return this.#kind;
  }

  /** 问题文本。 */
  get question(): string {
    return this.#question;
  }

  /** 可选答案。 */
  get options(): unknown[] | null {
    return this.#options;
  }

  /** 状态。 */
  get status(): AttentionStatus {
    return this.#status;
  }

  /** 截止时间。 */
  get deadline(): Date {
    return this.#deadline;
  }

  /** 等待对象。 */
  get assignee(): string {
    return this.#assignee;
  }

  /** 决定人。 */
  get decidedBy(): string | null {
    return this.#decidedBy;
  }

  /** 决定时间。 */
  get decidedAt(): Date | null {
    return this.#decidedAt;
  }

  /** 答案负载。 */
  get answer(): unknown {
    return this.#answer;
  }

  /** 创建时间。 */
  get createdAt(): Date {
    return this.#createdAt;
  }

  /** 最近更新时间。 */
  get updatedAt(): Date {
    return this.#updatedAt;
  }

  /** 是否待答且未过期。 */
  isOpen(at: Date): boolean {
    if (this.#status !== 'open') return false;
    return this.#deadline > at;
  }

  /** 回答；仅待答可回答。 */
  answerWith(answer: unknown, decidedBy: string, at: Date): void {
    if (this.#status !== 'open')
      throw new AttentionStateError('closed', '关注已关闭，不能回答');
    if (!decidedBy.trim()) throw new Error('决定人不能为空');
    if (this.#deadline <= at)
      throw new AttentionStateError('expired', '关注已过期，不能回答');
    this.#status = 'answered';
    this.#answer = answer;
    this.#decidedBy = decidedBy;
    this.#decidedAt = at;
    this.#updatedAt = at;
  }

  /** 过期；仅待答可过期，重复调用幂等。 */
  expire(at: Date): void {
    if (this.#status !== 'open') return;
    this.#status = 'expired';
    this.#updatedAt = at;
  }

  /** 导出快照。 */
  toSnapshot(): AttentionSnapshot {
    return {
      id: this.#id,
      ticketId: this.#ticketId,
      kind: this.#kind,
      question: this.#question,
      options: this.#options,
      status: this.#status,
      deadline: this.#deadline,
      assignee: this.#assignee,
      decidedBy: this.#decidedBy,
      decidedAt: this.#decidedAt,
      answer: this.#answer,
      createdAt: this.#createdAt,
      updatedAt: this.#updatedAt,
    };
  }
}
