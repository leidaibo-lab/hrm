import type { AdmissionCell, AdmissionRule } from './admission-rule.entity';

/** 准入规则仓储的 DI 令牌。 */
export const ADMISSION_RULE_REPOSITORY = Symbol('ADMISSION_RULE_REPOSITORY');

/** 准入规则仓储端口：按策略版本整体发布。 */
export interface AdmissionRuleRepository {
  /** 列出某策略版本的全部规则。 */
  listByPolicy(policyId: string): Promise<AdmissionRule[]>;
  /** 查某个策略、源实例、范围行与单元格的唯一规则。 */
  find(input: {
    policyId: string;
    sourceInstanceId: string;
    scopeRow: string;
    cell: AdmissionCell;
  }): Promise<AdmissionRule | null>;
  /** 批量创建规则（同一策略版本一次发布）。 */
  createMany(rules: AdmissionRule[]): Promise<void>;
}
