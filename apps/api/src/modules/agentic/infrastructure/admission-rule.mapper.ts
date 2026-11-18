import type { AdmissionRule as AdmissionRuleRow } from '../../../platform/prisma/generated/client';
import type { AdmissionCell } from '../domain/admission-rule.entity';
import { AdmissionRule } from '../domain/admission-rule.entity';

/** Prisma 行 → 准入规则聚合；domain ← 持久化形态的唯一翻译点。 */
export function toAdmissionRuleDomain(row: AdmissionRuleRow): AdmissionRule {
  return AdmissionRule.rehydrate({
    id: row.id,
    policyId: row.policyId,
    sourceInstanceId: row.sourceInstanceId,
    scopeRow: row.scopeRow,
    cell: row.cell as AdmissionCell,
    allowed: row.allowed,
    createdAt: row.createdAt,
  });
}
