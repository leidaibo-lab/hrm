import type { PolicyRules } from '../../domain/policy.entity';
import { ASSESS_AGENT } from './agents/assess.agent';
import { BREAKDOWN_AGENT } from './agents/breakdown.agent';
import { CLARIFY_AGENT } from './agents/clarify.agent';
import { ROUTER_AGENT } from './agents/router.agent';
import { WATCHDOG_AGENT } from './agents/watchdog.agent';

/** 执行角色键：与 PRD runtime.md 角色注册表一致。 */
export type AgentRoleKey =
  | 'router'
  | 'assess'
  | 'clarify'
  | 'breakdown'
  | 'watchdog';

/** 模型档位：由策略按档位解析模型路由，代码不写死型号。 */
export type ModelTier = 'fast' | 'main' | 'judge';

/** 角色定义：模型档位、提示词与工具白名单。 */
export interface AgentRoleDefinition {
  /** 角色键。 */
  key: AgentRoleKey;
  /** 显示名。 */
  name: string;
  /** 模型档位。 */
  modelTier: ModelTier;
  /** 系统提示词。 */
  instructions: string;
  /** 允许调用的工具标识。 */
  tools: readonly string[];
}

/** 角色注册表：新增角色 = 新增 agent 定义 + 注册一行。 */
export const AGENT_ROLES: readonly AgentRoleDefinition[] = Object.freeze([
  ROUTER_AGENT,
  ASSESS_AGENT,
  CLARIFY_AGENT,
  BREAKDOWN_AGENT,
  WATCHDOG_AGENT,
]);

/** 判断字符串是否为已注册执行角色键。 */
export function isAgentRoleKey(value: string): value is AgentRoleKey {
  return AGENT_ROLES.some((role) => role.key === value);
}

/** 按角色键取定义；未知键直接报错。 */
export function getAgentRole(key: AgentRoleKey): AgentRoleDefinition {
  const role = AGENT_ROLES.find((item) => item.key === key);
  if (!role) throw new Error(`未知执行角色：${key}`);
  return role;
}

/** 工具 → 所需权限点；未知工具返回 null（拒绝）。 */
const TOOL_PERMISSIONS: Readonly<Record<string, string>> = Object.freeze({
  'read-ticket': 'ticket:read',
  'search-similar': 'ticket:read',
  'read-document': 'ticket:read',
});

/** 取工具所需权限点；未登记工具返回 null。 */
export function permissionForTool(tool: string): string | null {
  return TOOL_PERMISSIONS[tool] ?? null;
}

/**
 * 解析角色实际模型路由：已发布的角色版本优先，其次策略档位。
 * 版本表是「角色配置」事实源时，换模型后新运行立即生效。
 */
export function resolveRoleRoute(
  policyRoute: string | null,
  latestVersionModel?: string | null,
): string | null {
  const version = latestVersionModel?.trim();
  if (version) return version;
  return policyRoute;
}

/**
 * 按档位解析模型路由：先取档位专属键，再按兼容顺序回落。
 * 未配置任何可用路由时返回 null，由调用方降级。
 */
export function resolveModelRoute(
  rules: PolicyRules,
  tier: ModelTier,
): string | null {
  let route: string | undefined;
  if (tier === 'fast') {
    route = rules.fastModel ?? rules.assessmentModel;
  } else if (tier === 'judge') {
    route =
      rules.judgeModel ??
      rules.mainModel ??
      rules.clarificationModel ??
      rules.assessmentModel;
  } else {
    route =
      rules.mainModel ?? rules.clarificationModel ?? rules.assessmentModel;
  }
  return route?.trim() ? route.trim() : null;
}
