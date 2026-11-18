import { perm } from './define';

/** model-gateway 域（ADR-0084）：供应商、逻辑模型、候选、价格、汇率、目录与用量报表。 */
export const modelGatewayPermissions = {
  read: perm(
    'model.gateway',
    'read',
    '模型网关只读：供应商、逻辑模型、候选、价格、汇率、目录与用量成本查看',
  ),
  manage: perm(
    'model.gateway',
    'manage',
    '模型网关管理：供应商与凭据、模型与候选、价格与汇率、目录同步、用量报表维护',
  ),
} as const;
