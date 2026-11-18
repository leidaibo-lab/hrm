import type { MandateStrength } from './mandate.entity';

/** 研判结论类型：accept 接单，其余为终止或忽略。 */
export type DecisionKind = 'accept' | 'stop' | 'ignore' | 'unavailable';

/** 研判结论快照：不可变事实。 */
export interface DecisionSnapshot {
  /** 结论主键。 */
  id: string;
  /** 所属线程主键。 */
  threadId: string;
  /** 结论类型。 */
  kind: DecisionKind;
  /** 依据强度。 */
  strength: MandateStrength;
  /** 授权范围建议。 */
  scope: unknown;
  /** 命中的规则标识。 */
  matchedRuleIds: string[] | null;
  /** 依据的策略主键。 */
  policyId: string;
  /** 依据的策略版本。 */
  policyVersion: number;
  /** 结论说明。 */
  reason: string | null;
  /** 本批参与研判的事件主键。 */
  triggerIds: string[];
  /** 结论时间。 */
  createdAt: Date;
}

/** 创建结论的输入。 */
export interface CreateDecisionInput {
  /** 结论主键。 */
  id: string;
  /** 所属线程主键。 */
  threadId: string;
  /** 结论类型。 */
  kind: DecisionKind;
  /** 依据强度。 */
  strength: MandateStrength;
  /** 授权范围建议。 */
  scope: unknown;
  /** 命中的规则标识。 */
  matchedRuleIds?: string[] | null;
  /** 依据的策略主键。 */
  policyId: string;
  /** 依据的策略版本。 */
  policyVersion: number;
  /** 结论说明。 */
  reason?: string | null;
  /** 本批参与研判的事件主键。 */
  triggerIds: string[];
  /** 结论时间；缺省为当前时间。 */
  now?: Date;
}

/**
 * 研判结论聚合：记录「这一批事件是否值得开工」。
 * 不可变；只有 accept 才会派生 Ticket 与 Mandate。
 */
export class Decision {
  readonly #id: string;
  readonly #threadId: string;
  readonly #kind: DecisionKind;
  readonly #strength: MandateStrength;
  readonly #scope: unknown;
  readonly #matchedRuleIds: string[] | null;
  readonly #policyId: string;
  readonly #policyVersion: number;
  readonly #reason: string | null;
  readonly #triggerIds: string[];
  readonly #createdAt: Date;

  private constructor(snapshot: DecisionSnapshot) {
    this.#id = snapshot.id;
    this.#threadId = snapshot.threadId;
    this.#kind = snapshot.kind;
    this.#strength = snapshot.strength;
    this.#scope = snapshot.scope;
    this.#matchedRuleIds = snapshot.matchedRuleIds;
    this.#policyId = snapshot.policyId;
    this.#policyVersion = snapshot.policyVersion;
    this.#reason = snapshot.reason;
    this.#triggerIds = snapshot.triggerIds;
    this.#createdAt = snapshot.createdAt;
  }

  /** 创建结论。 */
  static create(input: CreateDecisionInput): Decision {
    if (input.triggerIds.length === 0) throw new Error('结论必须关联事件批次');
    if (input.policyVersion < 1) throw new Error('策略版本必须为正整数');
    if (
      !input.reason?.trim() &&
      (input.matchedRuleIds ?? []).filter((id) => id.trim()).length === 0
    )
      throw new Error('结论必须带依据（reason 或 matchedRuleIds）');
    return new Decision({
      id: input.id,
      threadId: input.threadId,
      kind: input.kind,
      strength: input.strength,
      scope: input.scope,
      matchedRuleIds: input.matchedRuleIds ?? null,
      policyId: input.policyId,
      policyVersion: input.policyVersion,
      reason: input.reason ?? null,
      triggerIds: input.triggerIds,
      createdAt: input.now ?? new Date(),
    });
  }

  /** 从持久化快照重建。 */
  static rehydrate(snapshot: DecisionSnapshot): Decision {
    return new Decision(snapshot);
  }

  /** 结论主键。 */
  get id(): string {
    return this.#id;
  }

  /** 所属线程主键。 */
  get threadId(): string {
    return this.#threadId;
  }

  /** 结论类型。 */
  get kind(): DecisionKind {
    return this.#kind;
  }

  /** 依据强度。 */
  get strength(): MandateStrength {
    return this.#strength;
  }

  /** 授权范围建议。 */
  get scope(): unknown {
    return this.#scope;
  }

  /** 命中规则。 */
  get matchedRuleIds(): string[] | null {
    return this.#matchedRuleIds;
  }

  /** 策略主键。 */
  get policyId(): string {
    return this.#policyId;
  }

  /** 策略版本。 */
  get policyVersion(): number {
    return this.#policyVersion;
  }

  /** 结论说明。 */
  get reason(): string | null {
    return this.#reason;
  }

  /** 参与研判的事件。 */
  get triggerIds(): string[] {
    return [...this.#triggerIds];
  }

  /** 结论时间。 */
  get createdAt(): Date {
    return this.#createdAt;
  }

  /** 是否接单。 */
  get isAccepted(): boolean {
    return this.#kind === 'accept';
  }

  /** 导出快照。 */
  toSnapshot(): DecisionSnapshot {
    return {
      id: this.#id,
      threadId: this.#threadId,
      kind: this.#kind,
      strength: this.#strength,
      scope: this.#scope,
      matchedRuleIds: this.#matchedRuleIds,
      policyId: this.#policyId,
      policyVersion: this.#policyVersion,
      reason: this.#reason,
      triggerIds: this.#triggerIds,
      createdAt: this.#createdAt,
    };
  }
}
