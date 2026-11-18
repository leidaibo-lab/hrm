/** 源健康状态。 */
export type HealthState = 'starting' | 'ready' | 'error' | 'paused';

/** 源健康快照。 */
export interface SourceHealthSnapshot {
  /** 来源实例主键。 */
  instanceId: string;
  /** 健康检查条目。 */
  entry: string;
  /** 状态。 */
  state: HealthState;
  /** 详情。 */
  detail: string | null;
  /** 检查时间。 */
  checkedAt: Date;
}

/** 创建健康记录的输入。 */
export interface CreateSourceHealthInput {
  /** 来源实例主键。 */
  instanceId: string;
  /** 检查条目。 */
  entry: string;
  /** 状态。 */
  state: HealthState;
  /** 详情。 */
  detail?: string | null;
  /** 检查时间；缺省为当前时间。 */
  now?: Date;
}

/** 源健康聚合：按实例与条目记录。 */
export class SourceHealth {
  readonly #instanceId: string;
  readonly #entry: string;
  #state: HealthState;
  #detail: string | null;
  #checkedAt: Date;

  private constructor(snapshot: SourceHealthSnapshot) {
    this.#instanceId = snapshot.instanceId;
    this.#entry = snapshot.entry;
    this.#state = snapshot.state;
    this.#detail = snapshot.detail;
    this.#checkedAt = snapshot.checkedAt;
  }

  /** 创建健康记录。 */
  static create(input: CreateSourceHealthInput): SourceHealth {
    if (!input.entry.trim()) throw new Error('健康条目不能为空');
    return new SourceHealth({
      instanceId: input.instanceId,
      entry: input.entry,
      state: input.state,
      detail: input.detail ?? null,
      checkedAt: input.now ?? new Date(),
    });
  }

  /** 从持久化快照重建。 */
  static rehydrate(snapshot: SourceHealthSnapshot): SourceHealth {
    return new SourceHealth(snapshot);
  }

  /** 来源实例主键。 */
  get instanceId(): string {
    return this.#instanceId;
  }

  /** 检查条目。 */
  get entry(): string {
    return this.#entry;
  }

  /** 状态。 */
  get state(): HealthState {
    return this.#state;
  }

  /** 详情。 */
  get detail(): string | null {
    return this.#detail;
  }

  /** 检查时间。 */
  get checkedAt(): Date {
    return this.#checkedAt;
  }

  /** 更新状态。 */
  mark(state: HealthState, detail: string | null, at: Date): void {
    this.#state = state;
    this.#detail = detail;
    this.#checkedAt = at;
  }

  /** 导出快照。 */
  toSnapshot(): SourceHealthSnapshot {
    return {
      instanceId: this.#instanceId,
      entry: this.#entry,
      state: this.#state,
      detail: this.#detail,
      checkedAt: this.#checkedAt,
    };
  }
}
