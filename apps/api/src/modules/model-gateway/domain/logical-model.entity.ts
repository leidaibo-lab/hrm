import {
  type CandidateEntry,
  type ModelCapabilityRequirement,
  satisfiesCapability,
} from './candidate.entity';
import { ModelCallError } from './model-call.error';

/** 链解析输入：时点、能力要求与链长上限。 */
export interface ResolveChainInput {
  /** 解析时点，用于判断熔断与生效时间。 */
  at: Date;
  /** 本次调用的能力要求。 */
  requirement: ModelCapabilityRequirement;
  /** 链长上限，取逻辑模型配置。 */
  maxAttempts: number;
}

/**
 * 逻辑模型：候选链锚点。
 * 链解析是纯函数：启用、供应商状态、熔断、能力、优先级、链长。
 */
export class LogicalModelEntity {
  constructor(
    readonly id: string,
    readonly logicalKey: string,
    readonly enabled: boolean,
    readonly maxAttempts: number,
  ) {}

  resolveChain(
    candidates: readonly CandidateEntry[],
    input: ResolveChainInput,
  ): CandidateEntry[] {
    if (!this.enabled) {
      throw new ModelCallError(
        'model.logical_model_not_found',
        '逻辑模型已停用',
        false,
      );
    }
    const chain = candidates
      .filter((entry) => entry.enabled && entry.providerEnabled)
      .filter((entry) => entry.providerHealth === 'healthy')
      .filter(
        (entry) =>
          entry.providerOpenUntil === null ||
          entry.providerOpenUntil.getTime() <= input.at.getTime(),
      )
      .filter((entry) =>
        satisfiesCapability(entry.capabilities, input.requirement),
      )
      .sort((left, right) => left.priority - right.priority)
      .slice(0, Math.max(1, this.maxAttempts));

    if (chain.length === 0) {
      throw new ModelCallError(
        'model.capability_unsupported',
        '没有满足要求的候选',
        false,
      );
    }
    return chain;
  }
}
