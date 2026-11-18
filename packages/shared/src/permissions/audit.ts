import { perm } from './define';

/** 审计域：跨工单/线程的轨迹读取。 */
export const auditPermissions = {
  read: perm('audit', 'read', '查看工单与线程的审计轨迹'),
} as const;
