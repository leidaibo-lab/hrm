import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  ASSESSMENT_PORT,
  type AssessmentPort,
} from '../domain/assessment.port';
import type { ClarificationQueuePort } from '../domain/clarification-queue.port';
import { CLARIFICATION_QUEUE } from '../domain/clarification-queue.port';
import type { Decision } from '../domain/decision.entity';
import { Decision as DecisionAggregate } from '../domain/decision.entity';
import {
  DECISION_REPOSITORY,
  type DecisionRepository,
} from '../domain/decision.repository';
import type { Mandate } from '../domain/mandate.entity';
import type { Policy } from '../domain/policy.entity';
import type { Ticket, TicketKind } from '../domain/ticket.entity';
import type { Trigger } from '../domain/trigger.entity';
import {
  TRIGGER_REPOSITORY,
  type TriggerRepository,
} from '../domain/trigger.repository';
import { AcceptanceService } from './acceptance.service';

/** 研判输入：事件批次、策略与发起人上下文。 */
export interface EvaluateInput {
  /** 所属线程主键。 */
  threadId: string;
  /** 本批待研判事件，不能为空。 */
  triggers: Trigger[];
  /** 当前策略。 */
  policy: Policy;
  /** 源内发起人标识。 */
  actorId: string;
  /** 平台用户标识。 */
  actorUserId?: string | null;
  /** 来源类型。 */
  sourceType: string;
  /** 授权范围建议。 */
  scope: unknown;
  /** 项目或空间标识。 */
  scopeKey?: string | null;
  /** 默认工单类型；研判结果可覆盖。 */
  defaultTicketKind?: TicketKind;
  /** 当前时间；缺省为系统时间。 */
  now?: Date;
}

/** 研判结果：接单时带工单与授权。 */
export interface EvaluateResult {
  /** 结论。 */
  decision: Decision;
  /** 接单时生成的工单。 */
  ticket?: Ticket;
  /** 接单时生成的授权。 */
  mandate?: Mandate;
}

/**
 * 研判服务：Gate（确定性）+ Assessment（模型）。
 * 接单走 AcceptanceService 的原子事务；其余结论只追加。
 */
@Injectable()
export class EvalService {
  constructor(
    @Inject(ASSESSMENT_PORT) private readonly assessment: AssessmentPort,
    @Inject(DECISION_REPOSITORY)
    private readonly decisions: DecisionRepository,
    @Inject(TRIGGER_REPOSITORY)
    private readonly triggers: TriggerRepository,
    private readonly acceptance: AcceptanceService,
    @Inject(CLARIFICATION_QUEUE)
    private readonly clarificationQueue: ClarificationQueuePort,
  ) {}

  /** 对一批事件给出结论；接单时派生工单与授权。 */
  async evaluate(input: EvaluateInput): Promise<EvaluateResult> {
    if (input.triggers.length === 0) throw new Error('研判批次不能为空');

    const now = input.now ?? new Date();
    const assessment = await this.assessment.assess({
      threadId: input.threadId,
      triggers: input.triggers,
      policy: input.policy,
    });

    let decision: Decision;
    let ticket: Ticket | undefined;
    let mandate: Mandate | undefined;

    if (assessment.kind === 'accept') {
      const accepted = await this.acceptance.accept({
        threadId: input.threadId,
        triggerIds: input.triggers.map((trigger) => trigger.id),
        policyId: input.policy.id,
        policyVersion: input.policy.version,
        strength: assessment.strength,
        scope: assessment.scope,
        actorId: input.actorId,
        actorUserId: input.actorUserId,
        sourceType: input.sourceType,
        matchedRules: assessment.matchedRuleIds,
        kind: assessment.ticketKind ?? input.defaultTicketKind ?? 'requirement',
        scopeKey: input.scopeKey,
        reason: assessment.reason,
        now,
      });
      decision = accepted.decision;
      ticket = accepted.ticket;
      mandate = accepted.mandate;
      await this.clarificationQueue.enqueue({
        ticketId: ticket.id,
        threadId: input.threadId,
        triggerIds: input.triggers.map((trigger) => trigger.id),
      });
    } else {
      decision = DecisionAggregate.create({
        id: randomUUID(),
        threadId: input.threadId,
        kind: assessment.kind,
        strength: assessment.strength,
        scope: assessment.scope,
        matchedRuleIds: assessment.matchedRuleIds,
        policyId: input.policy.id,
        policyVersion: input.policy.version,
        reason: assessment.reason,
        triggerIds: input.triggers.map((trigger) => trigger.id),
        now,
      });
      await this.decisions.create(decision);
    }

    for (const trigger of input.triggers) {
      if (!trigger.isPending) continue;
      trigger.markEvaluated(now);
      await this.triggers.saveDisposition(trigger);
    }

    return { decision, ticket, mandate };
  }
}
