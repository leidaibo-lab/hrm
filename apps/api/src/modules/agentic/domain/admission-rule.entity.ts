/** 准入单元格：按「是否在名单」「是否点名」组合。 */
export type AdmissionCell =
  | 'listed_unaddressed'
  | 'unlisted_addressed'
  | 'unlisted_unaddressed';

/** 准入规则快照。 */
export interface AdmissionRuleSnapshot {
  /** 规则主键。 */
  id: string;
  /** 所属策略主键。 */
  policyId: string;
  /** 源实例主键。 */
  sourceInstanceId: string;
  /** 范围行（项目、群或表格）。 */
  scopeRow: string;
  /** 单元格类型。 */
  cell: AdmissionCell;
  /** 是否允许发起。 */
  allowed: boolean;
  /** 创建时间。 */
  createdAt: Date;
}

/** 创建准入规则的输入。 */
export interface CreateAdmissionRuleInput {
  /** 规则主键。 */
  id: string;
  /** 所属策略主键。 */
  policyId: string;
  /** 源实例主键。 */
  sourceInstanceId: string;
  /** 范围行。 */
  scopeRow: string;
  /** 单元格类型。 */
  cell: AdmissionCell;
  /** 是否允许发起。 */
  allowed: boolean;
  /** 创建时间；缺省为当前时间。 */
  now?: Date;
}

/**
 * 准入规则聚合：策略版本下某个源实例、某个范围行的授权判定。
 * 不可变；随策略版本保留。
 */
export class AdmissionRule {
  readonly #id: string;
  readonly #policyId: string;
  readonly #sourceInstanceId: string;
  readonly #scopeRow: string;
  readonly #cell: AdmissionCell;
  readonly #allowed: boolean;
  readonly #createdAt: Date;

  private constructor(snapshot: AdmissionRuleSnapshot) {
    this.#id = snapshot.id;
    this.#policyId = snapshot.policyId;
    this.#sourceInstanceId = snapshot.sourceInstanceId;
    this.#scopeRow = snapshot.scopeRow;
    this.#cell = snapshot.cell;
    this.#allowed = snapshot.allowed;
    this.#createdAt = snapshot.createdAt;
  }

  /** 创建准入规则。 */
  static create(input: CreateAdmissionRuleInput): AdmissionRule {
    if (!input.scopeRow.trim()) throw new Error('准入范围不能为空');
    if (!input.sourceInstanceId.trim()) throw new Error('源实例不能为空');
    return new AdmissionRule({
      id: input.id,
      policyId: input.policyId,
      sourceInstanceId: input.sourceInstanceId,
      scopeRow: input.scopeRow,
      cell: input.cell,
      allowed: input.allowed,
      createdAt: input.now ?? new Date(),
    });
  }

  /** 从持久化快照重建。 */
  static rehydrate(snapshot: AdmissionRuleSnapshot): AdmissionRule {
    return new AdmissionRule(snapshot);
  }

  /** 规则主键。 */
  get id(): string {
    return this.#id;
  }

  /** 策略主键。 */
  get policyId(): string {
    return this.#policyId;
  }

  /** 源实例主键。 */
  get sourceInstanceId(): string {
    return this.#sourceInstanceId;
  }

  /** 范围行。 */
  get scopeRow(): string {
    return this.#scopeRow;
  }

  /** 单元格类型。 */
  get cell(): AdmissionCell {
    return this.#cell;
  }

  /** 是否允许发起。 */
  get allowed(): boolean {
    return this.#allowed;
  }

  /** 创建时间。 */
  get createdAt(): Date {
    return this.#createdAt;
  }

  /** 导出快照。 */
  toSnapshot(): AdmissionRuleSnapshot {
    return {
      id: this.#id,
      policyId: this.#policyId,
      sourceInstanceId: this.#sourceInstanceId,
      scopeRow: this.#scopeRow,
      cell: this.#cell,
      allowed: this.#allowed,
      createdAt: this.#createdAt,
    };
  }
}
