import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma';
import { AdmissionCell as PrismaAdmissionCell } from '../../../platform/prisma/generated/client';
import type { AdmissionRule } from '../domain/admission-rule.entity';
import type { AdmissionRuleRepository } from '../domain/admission-rule.repository';
import { toAdmissionRuleDomain } from './admission-rule.mapper';

/** AdmissionRuleRepository 的 Prisma 实现：按策略版本整体发布。 */
@Injectable()
export class AdmissionRulePrismaRepository implements AdmissionRuleRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** 列出某策略版本的全部规则。 */
  async listByPolicy(policyId: string): Promise<AdmissionRule[]> {
    const rows = await this.prisma.admissionRule.findMany({
      where: { policyId },
      orderBy: [{ scopeRow: 'asc' }, { cell: 'asc' }],
    });
    return rows.map((row) => toAdmissionRuleDomain(row));
  }

  /** 查唯一规则。 */
  async find(input: {
    policyId: string;
    sourceInstanceId: string;
    scopeRow: string;
    cell: AdmissionRule['cell'];
  }): Promise<AdmissionRule | null> {
    const row = await this.prisma.admissionRule.findUnique({
      where: {
        policyId_sourceInstanceId_scopeRow_cell: {
          policyId: input.policyId,
          sourceInstanceId: input.sourceInstanceId,
          scopeRow: input.scopeRow,
          cell: input.cell as PrismaAdmissionCell,
        },
      },
    });
    return row ? toAdmissionRuleDomain(row) : null;
  }

  /** 批量创建规则。 */
  async createMany(rules: AdmissionRule[]): Promise<void> {
    if (rules.length === 0) return;
    await this.prisma.admissionRule.createMany({
      data: rules.map((rule) => {
        const snapshot = rule.toSnapshot();
        return {
          id: snapshot.id,
          policyId: snapshot.policyId,
          sourceInstanceId: snapshot.sourceInstanceId,
          scopeRow: snapshot.scopeRow,
          cell: snapshot.cell as PrismaAdmissionCell,
          allowed: snapshot.allowed,
          createdAt: snapshot.createdAt,
        };
      }),
    });
  }
}
