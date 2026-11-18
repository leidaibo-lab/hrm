import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma';
import {
  Prisma,
  MandateStrength as PrismaMandateStrength,
  SourceType as PrismaSourceType,
} from '../../../platform/prisma/generated/client';
import type { Mandate } from '../domain/mandate.entity';
import type { MandateRepository } from '../domain/mandate.repository';
import { toMandateDomain } from './mandate.mapper';

/** MandateRepository 的 Prisma 实现：只增不改。 */
@Injectable()
export class MandatePrismaRepository implements MandateRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** 按主键查找。 */
  async findById(id: string): Promise<Mandate | null> {
    const row = await this.prisma.mandate.findUnique({ where: { id } });
    return row ? toMandateDomain(row) : null;
  }

  /** 创建授权。 */
  async create(mandate: Mandate): Promise<void> {
    const snapshot = mandate.toSnapshot();
    await this.prisma.mandate.create({
      data: {
        id: snapshot.id,
        policyId: snapshot.policyId,
        policyVersion: snapshot.policyVersion,
        strength: snapshot.strength as PrismaMandateStrength,
        scope: snapshot.scope as Prisma.InputJsonValue,
        actorId: snapshot.actorId,
        actorUserId: snapshot.actorUserId,
        sourceType: snapshot.sourceType as PrismaSourceType,
        matchedRules:
          snapshot.matchedRules === null
            ? Prisma.DbNull
            : (snapshot.matchedRules as Prisma.InputJsonValue),
        createdAt: snapshot.createdAt,
      },
    });
  }
}
