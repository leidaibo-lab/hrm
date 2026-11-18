import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { AdmissionCell } from '../domain/admission-rule.entity';
import { AdmissionRule } from '../domain/admission-rule.entity';
import {
  ADMISSION_RULE_REPOSITORY,
  type AdmissionRuleRepository,
} from '../domain/admission-rule.repository';
import type { MandateStrength } from '../domain/mandate.entity';
import { Policy, readPolicyRules } from '../domain/policy.entity';
import {
  POLICY_REPOSITORY,
  type PolicyRepository,
} from '../domain/policy.repository';

/** 发布策略版本的输入。 */
export interface PublishPolicyInput {
  /** 默认授权强度。 */
  acceptMode: MandateStrength;
  /** 规则体。 */
  rules: unknown;
  /** 创建人。 */
  createdBy: string;
  /** 当前时间；缺省为系统时间。 */
  now?: Date;
}

/** 发布准入规则的输入。 */
export interface PublishAdmissionRuleInput {
  /** 源实例主键。 */
  sourceInstanceId: string;
  /** 范围行。 */
  scopeRow: string;
  /** 单元格。 */
  cell: AdmissionCell;
  /** 是否允许。 */
  allowed: boolean;
}

/** 策略用例：版本化发布与准入表整体发布。 */
@Injectable()
export class PolicyService {
  constructor(
    @Inject(POLICY_REPOSITORY) private readonly policies: PolicyRepository,
    @Inject(ADMISSION_RULE_REPOSITORY)
    private readonly rules: AdmissionRuleRepository,
  ) {}

  /** 当前策略；没有返回 null。 */
  async current(): Promise<Policy | null> {
    return this.policies.findCurrent();
  }

  /** 出站永久失败告警目标；缺省未配置。 */
  async goneNotifyChatId(): Promise<string | undefined> {
    const current = await this.policies.findCurrent();
    return current
      ? readPolicyRules(current.rules).goneNotifyChatId
      : undefined;
  }

  /** 发布新版本：版本号自动取当前 +1。 */
  async publish(input: PublishPolicyInput): Promise<Policy> {
    const current = await this.policies.findCurrent();
    const policy = Policy.create({
      id: randomUUID(),
      version: (current?.version ?? 0) + 1,
      acceptMode: input.acceptMode,
      rules: input.rules,
      createdBy: input.createdBy,
      now: input.now,
    });
    await this.policies.create(policy);
    return policy;
  }

  /** 列出策略版本的准入表。 */
  async admissionRules(policyId: string): Promise<AdmissionRule[]> {
    return this.rules.listByPolicy(policyId);
  }

  /** 为指定策略版本发布准入表；同一单元格重复直接拒绝。 */
  async publishAdmissionRules(
    policyId: string,
    inputs: PublishAdmissionRuleInput[],
    now: Date = new Date(),
  ): Promise<AdmissionRule[]> {
    const policy = await this.findPolicy(policyId);
    if (inputs.length === 0) return [];

    const seen = new Set<string>();
    const rules = inputs.map((input) => {
      const key = `${input.sourceInstanceId}|${input.scopeRow}|${input.cell}`;
      if (seen.has(key)) throw new Error(`准入规则重复：${key}`);
      seen.add(key);
      return AdmissionRule.create({
        id: randomUUID(),
        policyId: policy.id,
        sourceInstanceId: input.sourceInstanceId,
        scopeRow: input.scopeRow,
        cell: input.cell,
        allowed: input.allowed,
        now,
      });
    });

    await this.rules.createMany(rules);
    return rules;
  }

  private async findPolicy(id: string): Promise<Policy> {
    const policy = await this.policies.findById(id);
    if (!policy) throw new Error(`策略不存在：${id}`);
    return policy;
  }
}
