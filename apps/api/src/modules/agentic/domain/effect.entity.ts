/** 副作用类型：建 Issue、发卡片、更新状态。 */
export type EffectKind = 'create_issue' | 'send_card' | 'update_status';

/** 副作用状态：待执行、成功、可重试失败、永久失败。 */
export type EffectStatus = 'pending' | 'succeeded' | 'failed' | 'gone';

/** 副作用快照。 */
export interface EffectSnapshot {
  /** 副作用主键。 */
  id: string;
  /** 幂等键，全局唯一。 */
  idempotencyKey: string;
  /** 副作用类型。 */
  kind: EffectKind;
  /** 目标标识。 */
  target: string;
  /** 状态。 */
  status: EffectStatus;
  /** 执行结果。 */
  result: unknown;
  /** 创建时间。 */
  createdAt: Date;
  /** 完成时间。 */
  completedAt: Date | null;
}

/** 创建副作用的输入。 */
export interface CreateEffectInput {
  /** 副作用主键。 */
  id: string;
  /** 幂等键。 */
  idempotencyKey: string;
  /** 副作用类型。 */
  kind: EffectKind;
  /** 目标标识。 */
  target: string;
  /** 创建时间；缺省为当前时间。 */
  now?: Date;
}

/**
 * 副作用聚合：外部调用的幂等记录。
 * 成功的结果可重放；失败可重试；永久失败终止。
 */
export class Effect {
  readonly #id: string;
  readonly #idempotencyKey: string;
  readonly #kind: EffectKind;
  readonly #target: string;
  #status: EffectStatus;
  #result: unknown;
  readonly #createdAt: Date;
  #completedAt: Date | null;

  private constructor(snapshot: EffectSnapshot) {
    this.#id = snapshot.id;
    this.#idempotencyKey = snapshot.idempotencyKey;
    this.#kind = snapshot.kind;
    this.#target = snapshot.target;
    this.#status = snapshot.status;
    this.#result = snapshot.result;
    this.#createdAt = snapshot.createdAt;
    this.#completedAt = snapshot.completedAt;
  }

  /** 创建待执行副作用。 */
  static create(input: CreateEffectInput): Effect {
    if (!input.idempotencyKey.trim()) throw new Error('副作用幂等键不能为空');
    if (!input.target.trim()) throw new Error('副作用目标不能为空');
    return new Effect({
      id: input.id,
      idempotencyKey: input.idempotencyKey,
      kind: input.kind,
      target: input.target,
      status: 'pending',
      result: null,
      createdAt: input.now ?? new Date(),
      completedAt: null,
    });
  }

  /** 从持久化快照重建。 */
  static rehydrate(snapshot: EffectSnapshot): Effect {
    return new Effect(snapshot);
  }

  /** 副作用主键。 */
  get id(): string {
    return this.#id;
  }

  /** 幂等键。 */
  get idempotencyKey(): string {
    return this.#idempotencyKey;
  }

  /** 副作用类型。 */
  get kind(): EffectKind {
    return this.#kind;
  }

  /** 目标标识。 */
  get target(): string {
    return this.#target;
  }

  /** 状态。 */
  get status(): EffectStatus {
    return this.#status;
  }

  /** 执行结果。 */
  get result(): unknown {
    return this.#result;
  }

  /** 创建时间。 */
  get createdAt(): Date {
    return this.#createdAt;
  }

  /** 完成时间。 */
  get completedAt(): Date | null {
    return this.#completedAt;
  }

  /** 是否已成功。 */
  get isSucceeded(): boolean {
    return this.#status === 'succeeded';
  }

  /** 标记成功。 */
  succeed(result: unknown, at: Date): void {
    if (this.#status !== 'pending')
      throw new Error(`副作用状态 ${this.#status} 不能标记成功`);
    this.#status = 'succeeded';
    this.#result = result;
    this.#completedAt = at;
  }

  /** 标记可重试失败。 */
  fail(result: unknown, at: Date): void {
    if (this.#status !== 'pending')
      throw new Error(`副作用状态 ${this.#status} 不能标记失败`);
    this.#status = 'failed';
    this.#result = result;
    this.#completedAt = at;
  }

  /** 标记永久失败。 */
  markGone(result: unknown, at: Date): void {
    if (this.#status !== 'pending' && this.#status !== 'failed')
      throw new Error(`副作用状态 ${this.#status} 不能终止`);
    this.#status = 'gone';
    this.#result = result;
    this.#completedAt = at;
  }

  /** 失败后重试：回到待执行。 */
  retry(): void {
    if (this.#status !== 'failed')
      throw new Error(`副作用状态 ${this.#status} 不能重试`);
    this.#status = 'pending';
    this.#completedAt = null;
  }

  /** 导出快照。 */
  toSnapshot(): EffectSnapshot {
    return {
      id: this.#id,
      idempotencyKey: this.#idempotencyKey,
      kind: this.#kind,
      target: this.#target,
      status: this.#status,
      result: this.#result,
      createdAt: this.#createdAt,
      completedAt: this.#completedAt,
    };
  }
}
