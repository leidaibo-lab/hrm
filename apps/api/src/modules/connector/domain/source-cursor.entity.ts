/** 来源游标快照：记录读取位置。 */
export interface SourceCursorSnapshot {
  /** 来源实例主键。 */
  instanceId: string;
  /** 游标负载，结构由适配器约束。 */
  cursor: unknown;
  /** 最近推进时间。 */
  updatedAt: Date;
}

/** 推进游标的输入。 */
export interface AdvanceCursorInput {
  /** 来源实例主键。 */
  instanceId: string;
  /** 新游标。 */
  cursor: unknown;
  /** 推进时间；缺省为当前时间。 */
  now?: Date;
}

/** 来源游标聚合：只前进，不回退。 */
export class SourceCursor {
  readonly #instanceId: string;
  readonly #cursor: unknown;
  readonly #updatedAt: Date;

  private constructor(snapshot: SourceCursorSnapshot) {
    this.#instanceId = snapshot.instanceId;
    this.#cursor = snapshot.cursor;
    this.#updatedAt = snapshot.updatedAt;
  }

  /** 初始化游标。 */
  static create(input: AdvanceCursorInput): SourceCursor {
    if (input.cursor === null || input.cursor === undefined)
      throw new Error('游标不能为空');
    return new SourceCursor({
      instanceId: input.instanceId,
      cursor: input.cursor,
      updatedAt: input.now ?? new Date(),
    });
  }

  /** 从持久化快照重建。 */
  static rehydrate(snapshot: SourceCursorSnapshot): SourceCursor {
    return new SourceCursor(snapshot);
  }

  /** 来源实例主键。 */
  get instanceId(): string {
    return this.#instanceId;
  }

  /** 游标负载。 */
  get cursor(): unknown {
    return this.#cursor;
  }

  /** 最近推进时间。 */
  get updatedAt(): Date {
    return this.#updatedAt;
  }

  /** 导出快照。 */
  toSnapshot(): SourceCursorSnapshot {
    return {
      instanceId: this.#instanceId,
      cursor: this.#cursor,
      updatedAt: this.#updatedAt,
    };
  }
}
