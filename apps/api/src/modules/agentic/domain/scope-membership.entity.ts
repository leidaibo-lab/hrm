/** 数据范围成员快照。 */
export interface ScopeMembershipSnapshot {
  /** 主键。 */
  id: string;
  /** 平台用户标识。 */
  userId: string;
  /** 项目或空间标识。 */
  scopeKey: string;
  /** 创建时间。 */
  createdAt: Date;
}

/** 创建数据范围成员的输入。 */
export interface CreateScopeMembershipInput {
  /** 主键。 */
  id: string;
  /** 平台用户标识。 */
  userId: string;
  /** 项目或空间标识。 */
  scopeKey: string;
  /** 创建时间；缺省为当前时间。 */
  now?: Date;
}

/** 数据范围成员：用户与项目/空间的授权关系，只增删不改。 */
export class ScopeMembership {
  readonly #id: string;
  readonly #userId: string;
  readonly #scopeKey: string;
  readonly #createdAt: Date;

  private constructor(snapshot: ScopeMembershipSnapshot) {
    this.#id = snapshot.id;
    this.#userId = snapshot.userId;
    this.#scopeKey = snapshot.scopeKey;
    this.#createdAt = snapshot.createdAt;
  }

  /** 创建成员关系。 */
  static create(input: CreateScopeMembershipInput): ScopeMembership {
    const userId = input.userId.trim();
    const scopeKey = input.scopeKey.trim();
    if (!userId) throw new Error('数据范围成员必须指定用户');
    if (!scopeKey) throw new Error('数据范围成员必须指定项目/空间');
    return new ScopeMembership({
      id: input.id,
      userId,
      scopeKey,
      createdAt: input.now ?? new Date(),
    });
  }

  /** 从持久化快照重建。 */
  static rehydrate(snapshot: ScopeMembershipSnapshot): ScopeMembership {
    return new ScopeMembership(snapshot);
  }

  /** 主键。 */
  get id(): string {
    return this.#id;
  }

  /** 平台用户标识。 */
  get userId(): string {
    return this.#userId;
  }

  /** 项目或空间标识。 */
  get scopeKey(): string {
    return this.#scopeKey;
  }

  /** 创建时间。 */
  get createdAt(): Date {
    return this.#createdAt;
  }

  /** 导出快照。 */
  toSnapshot(): ScopeMembershipSnapshot {
    return {
      id: this.#id,
      userId: this.#userId,
      scopeKey: this.#scopeKey,
      createdAt: this.#createdAt,
    };
  }
}
