/** 工具级有效权限端口的 DI 令牌。 */
export const TOOL_ACCESS = Symbol('TOOL_ACCESS');

/** 工具级授权输入。 */
export interface ToolAccessInput {
  /** 触发人平台用户标识；未知时拒绝。 */
  actorUserId: string | null;
  /** 执行角色键。 */
  role: string;
  /** 工具标识。 */
  tool: string;
  /** 工单范围；用于范围校验。 */
  scopeKey: string | null;
  /** 判定时间。 */
  now?: Date;
}

/** 工具级有效权限：角色工具白名单 ∩ 触发人权限点。 */
export interface ToolAccessPort {
  /** 是否允许该角色以该触发人身份调用工具。 */
  authorize(input: ToolAccessInput): Promise<boolean>;
}
