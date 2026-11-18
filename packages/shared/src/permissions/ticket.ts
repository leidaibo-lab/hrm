import { perm } from './define';

/** agentic 域：工单、线程、关注与产物。 */
export const ticketPermissions = {
  read: perm('ticket', 'read', '查看工单、线程、关注与产物'),
  decide: perm('ticket', 'decide', '处理关注：回答问题、确认或拒绝'),
  updateStatus: perm('ticket', 'update', '更新工单状态：结束或重新打开'),
} as const;
