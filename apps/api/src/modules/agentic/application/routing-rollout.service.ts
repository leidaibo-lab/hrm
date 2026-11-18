import { Inject, Injectable } from '@nestjs/common';
import { readPolicyRules } from '../domain/policy.entity';
import {
  POLICY_REPOSITORY,
  type PolicyRepository,
} from '../domain/policy.repository';

/** 异步路由灰度判定输入。 */
export interface RoutingRolloutInput {
  /** 来源类型。 */
  sourceType: string;
  /** 项目或空间标识。 */
  scopeKey: string | null;
  /** 执行角色；配置了角色维度时必须提供。 */
  role?: string;
  /** 工单主键；配置了工单维度时必须提供。 */
  ticketId?: string;
}

/** 灰度判定结果。 */
export interface RoutingRolloutDecision {
  /** 是否走异步路径。 */
  enabled: boolean;
  /** 是否配置了灰度规则；未配置时不写审计。 */
  configured: boolean;
  /** 未启用的原因；启用时为空。 */
  reasons: string[];
}

/**
 * 异步路由灰度：按策略 `routingRollout` 决定走队列还是回退同步路由。
 * 规则缺省启用；按来源/项目白名单命中时启用，未命中回退同步路径。
 */
@Injectable()
export class RoutingRolloutService {
  constructor(
    @Inject(POLICY_REPOSITORY)
    private readonly policies: PolicyRepository,
  ) {}

  /** 当前来源/项目/角色/工单是否启用异步路由。 */
  async asyncEnabled(input: RoutingRolloutInput): Promise<boolean> {
    return (await this.decide(input)).enabled;
  }

  /** 判定灰度并给出未命中维度，供审计使用。 */
  async decide(input: RoutingRolloutInput): Promise<RoutingRolloutDecision> {
    const policy = await this.policies.findCurrent();
    if (!policy) return { enabled: true, configured: false, reasons: [] };
    const rollout = readPolicyRules(policy.rules).routingRollout;
    if (!rollout) return { enabled: true, configured: false, reasons: [] };

    const reasons: string[] = [];
    if (rollout.enabled === false) reasons.push('disabled');
    if (
      rollout.sources &&
      rollout.sources.length > 0 &&
      !rollout.sources.includes(input.sourceType)
    )
      reasons.push('source_not_matched');
    if (
      rollout.scopeKeys &&
      rollout.scopeKeys.length > 0 &&
      (input.scopeKey === null || !rollout.scopeKeys.includes(input.scopeKey))
    )
      reasons.push('scope_not_matched');
    if (
      rollout.roles &&
      rollout.roles.length > 0 &&
      (!input.role || !rollout.roles.includes(input.role))
    )
      reasons.push('role_not_matched');
    if (
      rollout.ticketIds &&
      rollout.ticketIds.length > 0 &&
      (!input.ticketId || !rollout.ticketIds.includes(input.ticketId))
    )
      reasons.push('ticket_not_matched');

    return {
      enabled: reasons.length === 0,
      configured: true,
      reasons,
    };
  }
}
