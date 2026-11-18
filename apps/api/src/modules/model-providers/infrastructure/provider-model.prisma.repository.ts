import type { TableQueryRequest } from '@cip/shared';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma';
import { Prisma } from '../../../platform/prisma/generated/client';
import {
  buildTableOrderBy,
  buildTableWhere,
  tablePageArgs,
} from '../../../platform/table-query';
import type { ProviderModel } from '../domain/provider-model.entity';
import {
  type ModelConfigurationField,
  type ModelView,
  type ProviderModelRepository,
} from '../domain/provider-model.repository';
import { toPersistenceError } from './model-persistence.helper';
import { toProviderModelDomain } from './provider-model.mapper';

/** 生效价联查：取 effectiveFrom <= now 的最新一版。 */
const currentPricingInclude = () =>
  ({
    pricings: {
      where: { effectiveFrom: { lte: new Date() } },
      orderBy: { effectiveFrom: 'desc' as const },
      take: 1,
    },
  }) as const;

type ModelRowWithRefs = {
  id: string;
  providerId: string;
  modelId: string;
  logicalKey: string;
  displayName: string;
  capabilities: unknown;
  defaultParams: unknown;
  enabled: boolean;
  createdAt: Date;
  provider: { slug: string; name: string; enabled: boolean };
  pricings: Array<{
    id: string;
    currency: string;
    input: PrismaDecimalLike;
    output: PrismaDecimalLike;
    cacheRead: PrismaDecimalLike | null;
    cacheWrite: PrismaDecimalLike | null;
    reasoning: PrismaDecimalLike | null;
    effectiveFrom: Date;
  }>;
};

/** decimal.js 实例的最小形态（Prisma Decimal）。 */
interface PrismaDecimalLike {
  toString(): string;
}

/** ProviderModelRepository 的 Prisma 实现：读模型联查供应商与生效价。 */
@Injectable()
export class ProviderModelPrismaRepository implements ProviderModelRepository {
  /** 展示字段 → 存储列绑定（enabled 以 enabled/disabled 枚举投影）。 */
  private static readonly bindings = {
    displayName: { type: 'column', column: 'displayName' },
    logicalKey: { type: 'column', column: 'logicalKey' },
    enabled: {
      type: 'boolean',
      column: 'enabled',
      truthy: 'enabled',
      falsy: 'disabled',
    },
    createdAt: { type: 'column', column: 'createdAt' },
  } as const;

  private static readonly qColumns = ['displayName', 'logicalKey'] as const;

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async queryTable(
    query: TableQueryRequest,
    forced?: { providerId?: string },
  ): Promise<{ items: ModelView[]; total: number }> {
    // scope.providerId 由应用层校验后作为强制 where 组合，客户端无法绕过。
    const extraWhere: Prisma.ProviderModelWhereInput | null = forced?.providerId
      ? { providerId: forced.providerId }
      : null;
    const where: Prisma.ProviderModelWhereInput = buildTableWhere(
      query,
      ProviderModelPrismaRepository.bindings,
      extraWhere,
      ProviderModelPrismaRepository.qColumns,
    ) as Prisma.ProviderModelWhereInput;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.providerModel.findMany({
        where,
        include: {
          provider: { select: { slug: true, name: true, enabled: true } },
          ...currentPricingInclude(),
        },
        orderBy: buildTableOrderBy(
          query,
          ProviderModelPrismaRepository.bindings,
        ) as Prisma.ProviderModelOrderByWithRelationInput[],
        ...tablePageArgs(query),
      }),
      this.prisma.providerModel.count({ where }),
    ]);
    return {
      total,
      items: rows.map((row) => this.toView(row)),
    };
  }

  async listByProvider(providerId: string): Promise<ModelView[]> {
    const rows = await this.prisma.providerModel.findMany({
      where: { providerId },
      include: {
        provider: { select: { slug: true, name: true, enabled: true } },
        ...currentPricingInclude(),
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.toView(row));
  }

  async listAll(filter?: {
    providerId?: string;
    capability?: string;
  }): Promise<ModelView[]> {
    const rows = await this.prisma.providerModel.findMany({
      where: {
        ...(filter?.providerId ? { providerId: filter.providerId } : {}),
        ...(filter?.capability
          ? {
              enabled: true,
              provider: { enabled: true },
              capabilities: { path: [filter.capability], equals: true },
            }
          : {}),
      },
      include: {
        provider: { select: { slug: true, name: true, enabled: true } },
        ...currentPricingInclude(),
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.toView(row));
  }

  async findViewById(id: string): Promise<ModelView | null> {
    const row = await this.prisma.providerModel.findUnique({
      where: { id },
      include: {
        provider: { select: { slug: true, name: true, enabled: true } },
        ...currentPricingInclude(),
      },
    });
    return row ? this.toView(row) : null;
  }

  async findById(id: string): Promise<ProviderModel | null> {
    const row = await this.prisma.providerModel.findUnique({ where: { id } });
    return row ? toProviderModelDomain(row) : null;
  }

  async findByLogicalKey(logicalKey: string): Promise<ModelView | null> {
    const row = await this.prisma.providerModel.findUnique({
      where: { logicalKey },
      include: {
        provider: { select: { slug: true, name: true, enabled: true } },
        ...currentPricingInclude(),
      },
    });
    return row ? this.toView(row) : null;
  }

  async existsByLogicalKey(logicalKey: string): Promise<boolean> {
    const row = await this.prisma.providerModel.findUnique({
      where: { logicalKey },
      select: { id: true },
    });
    return row !== null;
  }

  async existsByProviderModel(
    providerId: string,
    modelId: string,
  ): Promise<boolean> {
    const row = await this.prisma.providerModel.findFirst({
      where: { providerId, modelId },
      select: { id: true },
    });
    return row !== null;
  }

  async create(model: ProviderModel): Promise<ModelView> {
    const row = await this.prisma.providerModel
      .create({
        data: {
          providerId: model.providerId,
          modelId: model.modelId,
          logicalKey: model.logicalKey,
          displayName: model.displayName,
          capabilities: model.capabilities,
          defaultParams:
            model.defaultParams === null
              ? Prisma.JsonNull
              : model.defaultParams,
        },
        include: {
          provider: { select: { slug: true, name: true, enabled: true } },
          ...currentPricingInclude(),
        },
      })
      .catch((cause) => {
        throw toPersistenceError(cause);
      });
    return this.toView(row);
  }

  async saveConfiguration(
    model: ProviderModel,
    fields: readonly ModelConfigurationField[],
  ): Promise<void> {
    if (fields.length === 0) return;
    const data: Prisma.ProviderModelUpdateInput = {};
    for (const field of fields) {
      switch (field) {
        case 'displayName':
          data.displayName = model.displayName;
          break;
        case 'capabilities':
          data.capabilities = model.capabilities;
          break;
        case 'defaultParams':
          data.defaultParams =
            model.defaultParams === null
              ? Prisma.JsonNull
              : model.defaultParams;
          break;
      }
    }
    await this.prisma.providerModel.update({ where: { id: model.id }, data });
  }

  async saveEnabled(model: ProviderModel): Promise<void> {
    await this.prisma.providerModel.update({
      where: { id: model.id },
      data: { enabled: model.isEnabled },
    });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.providerModel.delete({ where: { id } }).catch((cause) => {
      throw toPersistenceError(cause);
    });
  }

  private toView(row: ModelRowWithRefs): ModelView {
    const domain = toProviderModelDomain(row);
    const pricing = row.pricings[0];
    return {
      id: row.id,
      providerId: row.providerId,
      providerSlug: row.provider.slug,
      providerName: row.provider.name,
      providerEnabled: row.provider.enabled,
      modelId: row.modelId,
      logicalKey: row.logicalKey,
      displayName: row.displayName,
      capabilities: domain.capabilities,
      defaultParams: domain.defaultParams,
      enabled: row.enabled,
      currentPricing: pricing
        ? {
            pricingId: pricing.id,
            currency: pricing.currency,
            input: pricing.input.toString(),
            output: pricing.output.toString(),
            cacheRead: pricing.cacheRead?.toString() ?? null,
            cacheWrite: pricing.cacheWrite?.toString() ?? null,
            reasoning: pricing.reasoning?.toString() ?? null,
            effectiveFrom: pricing.effectiveFrom.toISOString(),
          }
        : null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
