/** 来源授权快照。 */
export interface SourceAuthorizationSnapshot {
  /** 主键。 */
  id: string;
  /** 来源实例主键。 */
  sourceInstanceId: string;
  /** 群/项目范围标识。 */
  scopeKey: string;
  /** 授权人（飞书 open_id 或平台用户标识）。 */
  authorizedBy: string;
  /** 到期时间；null 表示长期。 */
  expiresAt: Date | null;
  /** 撤销时间；非空即失效。 */
  revokedAt: Date | null;
  /** 创建时间。 */
  createdAt: Date;
}

/** 来源授权：群管理员开启后记录，到期或撤销即失效。 */
export class SourceAuthorization {
  readonly #snapshot: SourceAuthorizationSnapshot;

  private constructor(snapshot: SourceAuthorizationSnapshot) {
    this.#snapshot = snapshot;
  }

  /** 创建授权。 */
  static create(input: {
    id: string;
    sourceInstanceId: string;
    scopeKey: string;
    authorizedBy: string;
    expiresAt?: Date | null;
    now?: Date;
  }): SourceAuthorization {
    const scopeKey = input.scopeKey.trim();
    const authorizedBy = input.authorizedBy.trim();
    if (!scopeKey) throw new Error('来源授权必须指定范围');
    if (!authorizedBy) throw new Error('来源授权必须指定授权人');
    const now = input.now ?? new Date();
    if (input.expiresAt && input.expiresAt.getTime() <= now.getTime())
      throw new Error('来源授权有效期必须晚于当前时间');
    return new SourceAuthorization({
      id: input.id,
      sourceInstanceId: input.sourceInstanceId,
      scopeKey,
      authorizedBy,
      expiresAt: input.expiresAt ?? null,
      revokedAt: null,
      createdAt: now,
    });
  }

  /** 从快照重建。 */
  static rehydrate(snapshot: SourceAuthorizationSnapshot): SourceAuthorization {
    return new SourceAuthorization(snapshot);
  }

  /** 主键。 */
  get id(): string {
    return this.#snapshot.id;
  }
  /** 来源实例主键。 */
  get sourceInstanceId(): string {
    return this.#snapshot.sourceInstanceId;
  }
  /** 范围标识。 */
  get scopeKey(): string {
    return this.#snapshot.scopeKey;
  }
  /** 授权人。 */
  get authorizedBy(): string {
    return this.#snapshot.authorizedBy;
  }
  /** 到期时间。 */
  get expiresAt(): Date | null {
    return this.#snapshot.expiresAt;
  }
  /** 撤销时间。 */
  get revokedAt(): Date | null {
    return this.#snapshot.revokedAt;
  }
  /** 创建时间。 */
  get createdAt(): Date {
    return this.#snapshot.createdAt;
  }

  /** 指定时间是否有效。 */
  isActive(at: Date = new Date()): boolean {
    if (this.#snapshot.revokedAt) return false;
    if (this.#snapshot.expiresAt && this.#snapshot.expiresAt <= at)
      return false;
    return true;
  }

  /** 撤销授权；重复撤销幂等。 */
  revoke(at: Date = new Date()): void {
    if (!this.#snapshot.revokedAt) this.#snapshot.revokedAt = at;
  }

  /** 导出快照。 */
  toSnapshot(): SourceAuthorizationSnapshot {
    return { ...this.#snapshot };
  }
}
