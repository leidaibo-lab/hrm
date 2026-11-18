import { perm } from './define';

/** agentic 策略域：准入表与研判规则的版本发布。 */
export const policyPermissions = {
  configure: perm('policy', 'configure', '发布策略版本与准入规则'),
} as const;
