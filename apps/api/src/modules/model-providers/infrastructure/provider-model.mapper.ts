import { defaultModelParamsSchema, modelCapabilitiesSchema } from '@cip/shared';
import { ProviderModel } from '../domain/provider-model.entity';

/** Prisma 行 → 领域聚合；JSON 列经 shared schema parse 校验（存入时已校验，防漂移）。 */
export function toProviderModelDomain(row: {
  id: string;
  providerId: string;
  modelId: string;
  logicalKey: string;
  displayName: string;
  capabilities: unknown;
  defaultParams: unknown;
  enabled: boolean;
}): ProviderModel {
  return ProviderModel.reconstitute({
    id: row.id,
    providerId: row.providerId,
    modelId: row.modelId,
    logicalKey: row.logicalKey,
    displayName: row.displayName,
    capabilities: modelCapabilitiesSchema.parse(row.capabilities),
    defaultParams:
      row.defaultParams === null || row.defaultParams === undefined
        ? null
        : defaultModelParamsSchema.parse(row.defaultParams),
    enabled: row.enabled,
  });
}
