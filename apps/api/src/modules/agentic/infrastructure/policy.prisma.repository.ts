import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma';
import {
  Prisma,
  MandateStrength as PrismaMandateStrength,
} from '../../../platform/prisma/generated/client';
import type { Policy } from '../domain/policy.entity';
import type { PolicyRepository } from '../domain/policy.repository';
import { toPolicyDomain } from './policy.mapper';

/** PolicyRepository 的 Prisma 实现：版本只增不改。 */
@Injectable()
export class PolicyPrismaRepository implements PolicyRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** 按主键查找。 */
  async findById(id: string): Promise<Policy | null> {
    const row = await this.prisma.policy.findUnique({ where: { id } });
    return row ? toPolicyDomain(row) : null;
  }

  /** 取当前生效版本。 */
  async findCurrent(): Promise<Policy | null> {
    const row = await this.prisma.policy.findFirst({
      orderBy: { version: 'desc' },
    });
    return row ? toPolicyDomain(row) : null;
  }

  /** 按版本号查找。 */
  async findByVersion(version: number): Promise<Policy | null> {
    const row = await this.prisma.policy.findUnique({ where: { version } });
    return row ? toPolicyDomain(row) : null;
  }

  /** 创建新版本。 */
  async create(policy: Policy): Promise<void> {
    const snapshot = policy.toSnapshot();
    await this.prisma.policy.create({
      data: {
        id: snapshot.id,
        version: snapshot.version,
        acceptMode: snapshot.acceptMode as PrismaMandateStrength,
        rules: snapshot.rules as Prisma.InputJsonValue,
        createdBy: snapshot.createdBy,
        createdAt: snapshot.createdAt,
      },
    });
  }
}
