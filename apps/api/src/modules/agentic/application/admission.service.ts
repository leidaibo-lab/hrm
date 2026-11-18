import { Inject, Injectable } from '@nestjs/common';
import type { AdmissionCell } from '../domain/admission-rule.entity';
import {
  ADMISSION_RULE_REPOSITORY,
  type AdmissionRuleRepository,
} from '../domain/admission-rule.repository';
import { isActorListed, type Policy } from '../domain/policy.entity';
import {
  POLICY_REPOSITORY,
  type PolicyRepository,
} from '../domain/policy.repository';

/** 准入判定的输入：来源范围 + 发起人是否在名单 + 是否点名。 */
export interface AdmissionInput {
  /** 源实例主键。 */
  sourceInstanceId: string;
  /** 范围行（项目、群或表格）。 */
  scopeRow: string;
  /** 发起人是否在策略名单内；缺省时按 actorId 从策略解析。 */
  actorListed?: boolean;
  /** 源内发起人标识；用于解析名单。 */
  actorId?: string;
  /** 事件是否点名机器人。 */
  addressed: boolean;
}

/** 准入判定的结果。 */
export interface AdmissionResult {
  /** 是否允许进入研判。 */
  admitted: boolean;
  /** 判定原因。 */
  reason: 'admitted' | 'no_policy' | 'no_rule' | 'denied';
  /** 依据的策略主键。 */
  policyId: string | null;
  /** 依据的策略版本。 */
  policyVersion: number | null;
  /** 命中的单元格；名单内被点名时为空。 */
  cell: AdmissionCell | null;
  /** 依据的策略；无策略时为空。 */
  policy: Policy | null;
}

/**
 * 准入服务（程序层 Fast Path）：只做确定性判定，不调模型。
 * 名单内成员被点名视为显式调用，直接通过；其余按准入表单元格判定。
 */
@Injectable()
export class AdmissionService {
  constructor(
    @Inject(POLICY_REPOSITORY) private readonly policies: PolicyRepository,
    @Inject(ADMISSION_RULE_REPOSITORY)
    private readonly rules: AdmissionRuleRepository,
  ) {}

  /** 判定一条事件是否允许进入研判。 */
  async evaluate(input: AdmissionInput): Promise<AdmissionResult> {
    const policy = await this.policies.findCurrent();
    if (!policy) {
      return {
        admitted: false,
        reason: 'no_policy',
        policyId: null,
        policyVersion: null,
        cell: null,
        policy: null,
      };
    }

    const listed =
      input.actorListed ??
      (input.actorId ? isActorListed(policy.rules, input.actorId) : false);

    if (listed && input.addressed) {
      return {
        admitted: true,
        reason: 'admitted',
        policyId: policy.id,
        policyVersion: policy.version,
        cell: null,
        policy,
      };
    }

    let cell: AdmissionCell = 'unlisted_unaddressed';
    if (listed) cell = 'listed_unaddressed';
    else if (input.addressed) cell = 'unlisted_addressed';

    const rule = await this.rules.find({
      policyId: policy.id,
      sourceInstanceId: input.sourceInstanceId,
      scopeRow: input.scopeRow,
      cell,
    });

    if (!rule) {
      return {
        admitted: false,
        reason: 'no_rule',
        policyId: policy.id,
        policyVersion: policy.version,
        cell,
        policy,
      };
    }

    return {
      admitted: rule.allowed,
      reason: rule.allowed ? 'admitted' : 'denied',
      policyId: policy.id,
      policyVersion: policy.version,
      cell,
      policy,
    };
  }
}
