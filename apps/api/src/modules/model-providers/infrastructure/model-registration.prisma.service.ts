import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma';
import type { CatalogModelView } from '../domain/catalog.port';
import type { ModelRegistrationPort } from '../domain/model-registration.port';
import type { ProviderModel } from '../domain/provider-model.entity';
import { toPersistenceError } from './model-persistence.helper';

/** 单模型与初始价格同一事务；失败整体回滚后允许重试。 */
@Injectable()
export class ModelRegistrationPrismaService implements ModelRegistrationPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    model: ProviderModel,
    entry: CatalogModelView,
    effectiveFrom: Date,
  ): Promise<'created' | 'skipped'> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const row = await tx.providerModel.create({
          data: {
            providerId: model.providerId,
            modelId: model.modelId,
            logicalKey: model.logicalKey,
            displayName: model.displayName,
            capabilities: model.capabilities,
          },
        });
        if (entry.input !== null && entry.output !== null)
          await tx.modelPricing.create({
            data: {
              modelId: row.id,
              currency: 'USD',
              input: entry.input,
              output: entry.output,
              cacheRead: entry.cacheRead,
              cacheWrite: entry.cacheWrite,
              reasoning: null,
              effectiveFrom,
            },
          });
      });
      return 'created';
    } catch (cause) {
      if (
        typeof cause === 'object' &&
        cause !== null &&
        (cause as { code?: string }).code === 'P2002'
      ) {
        const existing = await this.prisma.providerModel.findUnique({
          where: {
            providerId_modelId: {
              providerId: model.providerId,
              modelId: model.modelId,
            },
          },
        });
        if (existing) return 'skipped';
      }
      throw toPersistenceError(cause);
    }
  }
}
