import { perm } from './define';

/** Agent 配置域：角色、模型与提示词版本。 */
export const agentPermissions = {
  configure: perm('agent', 'configure', '查看与调整 Agent 角色、模型与提示词'),
} as const;
