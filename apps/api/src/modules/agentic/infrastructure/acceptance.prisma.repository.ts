import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma';
import {
  Prisma,
  DecisionKind as PrismaDecisionKind,
  MandateStrength as PrismaMandateStrength,
  SourceType as PrismaSourceType,
  SubscriptionReason as PrismaSubscriptionReason,
  TicketKind as PrismaTicketKind,
  TicketStatus as PrismaTicketStatus,
} from '../../../platform/prisma/generated/client';
import type { AcceptanceRepository } from '../domain/acceptance.repository';
import type { Decision } from '../domain/decision.entity';
import type { Mandate } from '../domain/mandate.entity';
import type { Subscription } from '../domain/subscription.entity';
import type { Ticket } from '../domain/ticket.entity';

/** AcceptanceRepository 的 Prisma 实现：三条写入在同一事务内完成。 */
@Injectable()
export class AcceptancePrismaRepository implements AcceptanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** 原子写入结论、授权与工单。 */
  async accept(input: {
    decision: Decision;
    mandate: Mandate;
    ticket: Ticket;
    subscription: Subscription;
  }): Promise<void> {
    const decision = input.decision.toSnapshot();
    const mandate = input.mandate.toSnapshot();
    const ticket = input.ticket.toSnapshot();
    const subscription = input.subscription.toSnapshot();

    await this.prisma.$transaction([
      this.prisma.decision.create({
        data: {
          id: decision.id,
          threadId: decision.threadId,
          kind: decision.kind as PrismaDecisionKind,
          strength: decision.strength as PrismaMandateStrength,
          scope: decision.scope as Prisma.InputJsonValue,
          matchedRuleIds:
            decision.matchedRuleIds === null
              ? Prisma.DbNull
              : (decision.matchedRuleIds as Prisma.InputJsonValue),
          policyId: decision.policyId,
          policyVersion: decision.policyVersion,
          reason: decision.reason,
          createdAt: decision.createdAt,
          triggers: {
            create: decision.triggerIds.map((triggerId) => ({ triggerId })),
          },
        },
      }),
      this.prisma.mandate.create({
        data: {
          id: mandate.id,
          policyId: mandate.policyId,
          policyVersion: mandate.policyVersion,
          strength: mandate.strength as PrismaMandateStrength,
          scope: mandate.scope as Prisma.InputJsonValue,
          actorId: mandate.actorId,
          actorUserId: mandate.actorUserId,
          sourceType: mandate.sourceType as PrismaSourceType,
          matchedRules:
            mandate.matchedRules === null
              ? Prisma.DbNull
              : (mandate.matchedRules as Prisma.InputJsonValue),
          createdAt: mandate.createdAt,
        },
      }),
      this.prisma.ticket.create({
        data: {
          id: ticket.id,
          mandateId: ticket.mandateId,
          threadId: ticket.threadId,
          scopeKey: ticket.scopeKey,
          kind: ticket.kind as PrismaTicketKind,
          status: ticket.status as PrismaTicketStatus,
          openedAt: ticket.openedAt,
          endedAt: ticket.endedAt,
          endReason: ticket.endReason,
          createdAt: ticket.createdAt,
          updatedAt: ticket.updatedAt,
        },
      }),
      this.prisma.subscription.create({
        data: {
          ticketId: subscription.ticketId,
          threadId: subscription.threadId,
          reason: subscription.reason as PrismaSubscriptionReason,
          createdAt: subscription.createdAt,
        },
      }),
    ]);
  }
}
