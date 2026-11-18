import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma';
import {
  Prisma,
  DecisionKind as PrismaDecisionKind,
  MandateStrength as PrismaMandateStrength,
} from '../../../platform/prisma/generated/client';
import type { Decision } from '../domain/decision.entity';
import type { DecisionRepository } from '../domain/decision.repository';
import { toDecisionDomain } from './decision.mapper';

/** DecisionRepository 的 Prisma 实现：结论与事件关联同一事务写入。 */
@Injectable()
export class DecisionPrismaRepository implements DecisionRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** 按主键查找，含事件关联。 */
  async findById(id: string): Promise<Decision | null> {
    const row = await this.prisma.decision.findUnique({
      where: { id },
      include: { triggers: { select: { triggerId: true } } },
    });
    return row ? toDecisionDomain(row) : null;
  }

  /** 列出线程结论。 */
  async listByThread(threadId: string): Promise<Decision[]> {
    const rows = await this.prisma.decision.findMany({
      where: { threadId },
      orderBy: { createdAt: 'asc' },
      include: { triggers: { select: { triggerId: true } } },
    });
    return rows.map((row) => toDecisionDomain(row));
  }

  /** 创建结论及其事件关联。 */
  async create(decision: Decision): Promise<void> {
    const snapshot = decision.toSnapshot();
    await this.prisma.decision.create({
      data: {
        id: snapshot.id,
        threadId: snapshot.threadId,
        kind: snapshot.kind as PrismaDecisionKind,
        strength: snapshot.strength as PrismaMandateStrength,
        scope: snapshot.scope as Prisma.InputJsonValue,
        matchedRuleIds:
          snapshot.matchedRuleIds === null
            ? Prisma.DbNull
            : (snapshot.matchedRuleIds as Prisma.InputJsonValue),
        policyId: snapshot.policyId,
        policyVersion: snapshot.policyVersion,
        reason: snapshot.reason,
        createdAt: snapshot.createdAt,
        triggers: {
          create: snapshot.triggerIds.map((triggerId) => ({ triggerId })),
        },
      },
    });
  }
}
