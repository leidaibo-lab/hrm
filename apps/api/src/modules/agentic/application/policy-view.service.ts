import type { AdmissionRule } from '../domain/admission-rule.entity';
import type { Policy } from '../domain/policy.entity';

/** 策略视图。 */
export interface PolicyView {
  /** 策略主键。 */
  id: string;
  /** 版本号。 */
  version: number;
  /** 默认强度。 */
  acceptMode: string;
  /** 规则体。 */
  rules: unknown;
  /** 创建人。 */
  createdBy: string;
  /** 创建时间。 */
  createdAt: string;
}

/** 准入规则视图。 */
export interface AdmissionRuleView {
  /** 规则主键。 */
  id: string;
  /** 策略主键。 */
  policyId: string;
  /** 源实例主键。 */
  sourceInstanceId: string;
  /** 范围行。 */
  scopeRow: string;
  /** 单元格。 */
  cell: string;
  /** 是否允许。 */
  allowed: boolean;
}

/** 策略 → 视图。 */
export function toPolicyView(policy: Policy): PolicyView {
  return {
    id: policy.id,
    version: policy.version,
    acceptMode: policy.acceptMode,
    rules: policy.rules,
    createdBy: policy.createdBy,
    createdAt: policy.createdAt.toISOString(),
  };
}

/** 准入规则 → 视图。 */
export function toAdmissionRuleView(rule: AdmissionRule): AdmissionRuleView {
  return {
    id: rule.id,
    policyId: rule.policyId,
    sourceInstanceId: rule.sourceInstanceId,
    scopeRow: rule.scopeRow,
    cell: rule.cell,
    allowed: rule.allowed,
  };
}
