import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  ACCEPTANCE_REPOSITORY,
  type AcceptanceRepository,
} from '../domain/acceptance.repository';
import { Decision } from '../domain/decision.entity';
import type { MandateStrength } from '../domain/mandate.entity';
import { Mandate } from '../domain/mandate.entity';
import { metrics } from '../domain/metrics.port';
import {
  THREAD_REPOSITORY,
  type ThreadRepository,
} from '../domain/thread.repository';
import type { TicketKind } from '../domain/ticket.entity';
import { Ticket } from '../domain/ticket.entity';
import { SubscriptionService } from './subscription.service';

/** 接单输入：研判结论 + 授权范围 + 工单类型。 */
export interface AcceptWorkInput {
  /** 所属线程主键。 */
  threadId: string;
  /** 本批参与研判的事件主键。 */
  triggerIds: string[];
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
  /** 工单类型。 */
  kind: TicketKind;
  /** 项目或空间标识。 */
  scopeKey?: string | null;
  /** 结论说明。 */
  reason?: string | null;
  /** 当前时间；缺省为系统时间。 */
  now?: Date;
}

/** 接单结果。 */
export interface AcceptWorkResult {
  /** 接单结论。 */
  decision: Decision;
  /** 授权。 */
  mandate: Mandate;
  /** 工单。 */
  ticket: Ticket;
}

/** 接单用例：构造结论、授权与工单，并原子落库。 */
@Injectable()
export class AcceptanceService {
  constructor(
    @Inject(ACCEPTANCE_REPOSITORY)
    private readonly acceptance: AcceptanceRepository,
    @Inject(THREAD_REPOSITORY) private readonly threads: ThreadRepository,
    private readonly subscriptions: SubscriptionService,
  ) {}

  /** 接单：结论、授权与工单一经写入不可分割。 */
  async accept(input: AcceptWorkInput): Promise<AcceptWorkResult> {
    await this.assertScope(input);
    const decision = Decision.create({
      id: randomUUID(),
      threadId: input.threadId,
      kind: 'accept',
      strength: input.strength,
      scope: input.scope,
      matchedRuleIds: input.matchedRules,
      policyId: input.policyId,
      policyVersion: input.policyVersion,
      reason: input.reason,
      triggerIds: input.triggerIds,
      now: input.now,
    });

    const mandate = Mandate.create({
      id: randomUUID(),
      policyId: input.policyId,
      policyVersion: input.policyVersion,
      strength: input.strength,
      scope: input.scope,
      actorId: input.actorId,
      actorUserId: input.actorUserId,
      sourceType: input.sourceType,
      matchedRules: input.matchedRules,
      now: input.now,
    });

    const ticket = Ticket.open({
      id: randomUUID(),
      mandateId: mandate.id,
      threadId: input.threadId,
      scopeKey: input.scopeKey,
      kind: input.kind,
      now: input.now,
    });

    const subscription = this.subscriptions.build({
      ticketId: ticket.id,
      threadId: ticket.threadId,
      reason: 'started',
      now: input.now,
    });
    await this.acceptance.accept({
      decision,
      mandate,
      ticket,
      subscription,
    });
    metrics.increment('agentic_events_total', { event: 'ticket_opened' });
    return { decision, mandate, ticket };
  }

  /** I6：工单范围必须落在所属线程范围内，禁止跨项目开票。 */
  private async assertScope(input: AcceptWorkInput): Promise<void> {
    if (!input.scopeKey) return;
    const thread = await this.threads.findById(input.threadId);
    if (!thread) throw new Error(`线程不存在：${input.threadId}`);
    if (thread.scopeKey !== null && thread.scopeKey !== input.scopeKey)
      throw new Error('工单范围必须与线程范围一致');
  }
}
