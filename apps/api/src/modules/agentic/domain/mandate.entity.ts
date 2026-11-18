/** 授权强度：explicit 明确授权，inferred 由规则推断。 */
export type MandateStrength = 'explicit' | 'inferred';

/** 授权快照：不可变的授权事实。 */
export interface MandateSnapshot {
  /** 授权主键。 */
  id: string;
  /** 依据的策略主键。 */
  policyId: string;
  /** 依据的策略版本。 */
  policyVersion: number;
  /** 授权强度。 */
  strength: MandateStrength;
  /** 授权范围，结构由 Policy 约束。 */
  scope: unknown;
  /** 源内发起人标识。 */
  actorId: string;
  /** 平台用户标识。 */
  actorUserId: string | null;
  /** 来源类型。 */
  sourceType: string;
  /** 命中的规则标识。 */
  matchedRules: string[] | null;
  /** 授权时间。 */
  createdAt: Date;
}

/** 创建授权的输入。 */
export interface CreateMandateInput {
  /** 授权主键。 */
  id: string;
  /** 依据的策略主键。 */
  policyId: string;
  /** 依据的策略版本。 */
  policyVersion: number;
  /** 授权强度。 */
  strength: MandateStrength;
  /** 授权范围。 */
  scope: unknown;
  /** 源内发起人标识。 */
  actorId: string;
  /** 平台用户标识。 */
  actorUserId?: string | null;
  /** 来源类型。 */
  sourceType: string;
  /** 命中的规则标识。 */
  matchedRules?: string[] | null;
  /** 授权时间；缺省为当前时间。 */
  now?: Date;
}

/**
 * 授权聚合：记录「凭什么可以做、能做到哪」。
 * 不可变；扩大范围必须新开 Ticket，撤回另行记录。
 */
export class Mandate {
  readonly #id: string;
  readonly #policyId: string;
  readonly #policyVersion: number;
  readonly #strength: MandateStrength;
  readonly #scope: unknown;
  readonly #actorId: string;
  readonly #actorUserId: string | null;
  readonly #sourceType: string;
  readonly #matchedRules: string[] | null;
  readonly #createdAt: Date;

  private constructor(snapshot: MandateSnapshot) {
    this.#id = snapshot.id;
    this.#policyId = snapshot.policyId;
    this.#policyVersion = snapshot.policyVersion;
    this.#strength = snapshot.strength;
    this.#scope = snapshot.scope;
    this.#actorId = snapshot.actorId;
    this.#actorUserId = snapshot.actorUserId;
    this.#sourceType = snapshot.sourceType;
    this.#matchedRules = snapshot.matchedRules;
    this.#createdAt = snapshot.createdAt;
  }

  /** 创建授权。 */
  static create(input: CreateMandateInput): Mandate {
    if (input.policyVersion < 1) throw new Error('策略版本必须为正整数');
    if (!input.actorId.trim()) throw new Error('授权发起人不能为空');
    if (input.scope === null || input.scope === undefined)
      throw new Error('授权范围不能为空');
    return new Mandate({
      id: input.id,
      policyId: input.policyId,
      policyVersion: input.policyVersion,
      strength: input.strength,
      scope: input.scope,
      actorId: input.actorId,
      actorUserId: input.actorUserId ?? null,
      sourceType: input.sourceType,
      matchedRules: input.matchedRules ?? null,
      createdAt: input.now ?? new Date(),
    });
  }

  /** 从持久化快照重建。 */
  static rehydrate(snapshot: MandateSnapshot): Mandate {
    return new Mandate(snapshot);
  }

  /** 授权主键。 */
  get id(): string {
    return this.#id;
  }

  /** 策略主键。 */
  get policyId(): string {
    return this.#policyId;
  }

  /** 策略版本。 */
  get policyVersion(): number {
    return this.#policyVersion;
  }

  /** 授权强度。 */
  get strength(): MandateStrength {
    return this.#strength;
  }

  /** 授权范围。 */
  get scope(): unknown {
    return this.#scope;
  }

  /** 源内发起人标识。 */
  get actorId(): string {
    return this.#actorId;
  }

  /** 平台用户标识。 */
  get actorUserId(): string | null {
    return this.#actorUserId;
  }

  /** 来源类型。 */
  get sourceType(): string {
    return this.#sourceType;
  }

  /** 命中规则。 */
  get matchedRules(): string[] | null {
    return this.#matchedRules;
  }

  /** 授权时间。 */
  get createdAt(): Date {
    return this.#createdAt;
  }

  /** 导出快照。 */
  toSnapshot(): MandateSnapshot {
    return {
      id: this.#id,
      policyId: this.#policyId,
      policyVersion: this.#policyVersion,
      strength: this.#strength,
      scope: this.#scope,
      actorId: this.#actorId,
      actorUserId: this.#actorUserId,
      sourceType: this.#sourceType,
      matchedRules: this.#matchedRules,
      createdAt: this.#createdAt,
    };
  }
}
