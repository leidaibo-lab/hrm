import type { ModelCapabilities } from '@cip/shared';

/** 本次调用对模型能力的要求；字段是能力事实的子集。 */
export interface ModelCapabilityRequirement {
  /** 本次是否使用工具调用。 */
  toolCall?: boolean;
  /** 是否需要结构化输出。 */
  structuredOutput?: boolean;
  /** 是否需要图像输入。 */
  imageInput?: boolean;
  /** 上下文窗口下限（token）。 */
  minContextWindow?: number;
}

/** 候选路由视图：能力事实与供应商状态已展开。 */
export interface CandidateEntry {
  /** 候选主键。 */
  id: string;
  /** 所属逻辑模型主键。 */
  logicalModelId: string;
  /** 供应商主键。 */
  providerId: string;
  /** 供应商路由段。 */
  providerSlug: string;
  /** 供应商侧模型名。 */
  providerModelId: string;
  /** 链内优先级，升序。 */
  priority: number;
  /** 候选是否启用。 */
  enabled: boolean;
  /** 候选能力事实。 */
  capabilities: ModelCapabilities;
  /** 供应商是否启用。 */
  providerEnabled: boolean;
  /** 供应商健康状态。 */
  providerHealth: 'healthy' | 'degraded';
  /** 熔断打开截止时间；null 表示未打开。 */
  providerOpenUntil: Date | null;
}

/** 能力事实是否满足本次要求。 */
export function satisfiesCapability(
  capabilities: ModelCapabilities,
  requirement: ModelCapabilityRequirement,
): boolean {
  if (requirement.toolCall && !capabilities.toolCall) return false;
  if (requirement.structuredOutput && !capabilities.structuredOutput)
    return false;
  if (requirement.imageInput && !capabilities.imageInput) return false;
  if (
    requirement.minContextWindow !== undefined &&
    capabilities.contextWindow < requirement.minContextWindow
  ) {
    return false;
  }
  return true;
}
