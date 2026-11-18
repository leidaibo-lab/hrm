import { perm } from './define';

/** 来源配置域：实例开通、停用与健康。 */
export const sourcePermissions = {
  configure: perm('source', 'configure', '开通、停用与查看来源实例'),
} as const;
