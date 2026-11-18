import type { DecisionKind } from './decision.entity';
import type { MandateStrength } from './mandate.entity';
import type { Policy } from './policy.entity';
import type { TicketKind } from './ticket.entity';
import type { Trigger } from './trigger.entity';

/** 研判端口的 DI 令牌。 */
export const ASSESSMENT_PORT = Symbol('ASSESSMENT_PORT');

/** 模型研判的输入：线程、事件批次与当前策略。 */
export interface AssessmentInput {
  /** 所属线程主键。 */
  threadId: string;
  /** 本批事件。 */
  triggers: Trigger[];
  /** 当前策略。 */
  policy: Policy;
}

/** 模型研判的结果。 */
export interface AssessmentResult {
  /** 结论类型。 */
  kind: DecisionKind;
  /** 依据强度。 */
  strength: MandateStrength;
  /** 授权范围建议。 */
  scope: unknown;
  /** 命中的规则标识。 */
  matchedRuleIds: string[] | null;
  /** 结论说明。 */
  reason: string | null;
  /** 建议的工单类型。 */
  ticketKind: TicketKind;
}

/** 研判端口：由 runtime 用模型实现，领域不感知模型细节。 */
export interface AssessmentPort {
  /** 对一批事件给出结论。 */
  assess(input: AssessmentInput): Promise<AssessmentResult>;
}
