import { perm } from './define';

/** 产物域：机器人写草稿。 */
export const artifactPermissions = {
  write: perm('artifact', 'write', '写入产物草稿'),
} as const;
