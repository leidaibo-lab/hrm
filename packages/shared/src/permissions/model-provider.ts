import { perm } from './define';

/** model-providers 域（ADR-0015）：模型服务商接入管理（供应商、模型、价格、用量）。 */
export const modelProviderPermissions = {
  manage: perm(
    'model-provider',
    'manage',
    '模型服务商管理：供应商与凭据、模型注册、价格版本与用量报表的全量管理',
  ),
} as const;
