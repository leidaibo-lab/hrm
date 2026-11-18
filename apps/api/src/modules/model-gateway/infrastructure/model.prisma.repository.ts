import {
  type DefaultModelParams,
  defaultModelParamsSchema,
  ERROR_CODE,
  type ModelCapabilities,
  modelCapabilitiesSchema,
} from '@cip/shared';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma';
import { Prisma } from '../../../platform/prisma/generated/client';
import {
  type CandidateCreateData,
  type CandidateRecord,
  type CandidateUpdateData,
  type CandidateWithProvider,
  type LogicalModelCreateData,
  type LogicalModelRecord,
  type LogicalModelUpdateData,
  type ModelRepository,
} from '../domain/model.repository';
import type { ProviderHealth } from '../domain/provider.entity';
import { translatePersistenceError } from './persistence.helper';

interface LogicalModelRow {
  id: string;
  logicalKey: string;
  displayName: string;
  enabled: boolean;
  maxAttempts: number;
  createdAt: Date;
}

interface CandidateRow {
  id: string;
  logicalModelId: string;
  providerId: string;
  providerModelId: string;
  catalogModelId: string | null;
  priority: number;
  enabled: boolean;
  timeoutMs: number | null;
  capabilities: unknown;
  defaultParams: unknown;
  createdAt: Date;
}

interface CandidateWithProviderRow extends CandidateRow {
  provider: {
    slug: string;
    enabled: boolean;
    health: string;
    openUntil: Date | null;
    catalogProviderId: string | null;
  };
}

/** ModelRepository 的 Prisma 实现：逻辑模型与候选共处一个聚合仓储。 */
@Injectable()
export class ModelPrismaRepository implements ModelRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async listLogical(): Promise<LogicalModelRecord[]> {
    const rows = await this.prisma.modelGatewayLogicalModel.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toLogical);
  }

  async findLogical(id: string): Promise<LogicalModelRecord | null> {
    const row = await this.prisma.modelGatewayLogicalModel.findUnique({
      where: { id },
    });
    return row ? toLogical(row) : null;
  }

  async findLogicalByKey(
    logicalKey: string,
  ): Promise<LogicalModelRecord | null> {
    const row = await this.prisma.modelGatewayLogicalModel.findUnique({
      where: { logicalKey },
    });
    return row ? toLogical(row) : null;
  }

  async createLogical(
    data: LogicalModelCreateData,
  ): Promise<LogicalModelRecord> {
    const row = await this.prisma.modelGatewayLogicalModel
      .create({
        data: {
          logicalKey: data.logicalKey,
          displayName: data.displayName,
          maxAttempts: data.maxAttempts,
        },
      })
      .catch((cause: unknown) =>
        translatePersistenceError(cause, {
          conflict: ERROR_CODE.model.logicalKeyConflict,
        }),
      );
    return toLogical(row);
  }

  async updateLogical(
    id: string,
    data: LogicalModelUpdateData,
  ): Promise<LogicalModelRecord> {
    const row = await this.prisma.modelGatewayLogicalModel.update({
      where: { id },
      data: {
        ...(data.displayName === undefined
          ? {}
          : { displayName: data.displayName }),
        ...(data.maxAttempts === undefined
          ? {}
          : { maxAttempts: data.maxAttempts }),
      },
    });
    return toLogical(row);
  }

  async setLogicalEnabled(
    id: string,
    enabled: boolean,
  ): Promise<LogicalModelRecord> {
    const row = await this.prisma.modelGatewayLogicalModel.update({
      where: { id },
      data: { enabled },
    });
    return toLogical(row);
  }

  async listCandidates(logicalModelId: string): Promise<CandidateRecord[]> {
    const rows = await this.prisma.modelGatewayCandidate.findMany({
      where: { logicalModelId },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(toCandidate);
  }

  async listCandidatesWithProvider(): Promise<CandidateWithProvider[]> {
    const rows = await this.prisma.modelGatewayCandidate.findMany({
      include: { provider: true },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((row) => toCandidateWithProvider(row));
  }

  async findCandidate(id: string): Promise<CandidateWithProvider | null> {
    const row = await this.prisma.modelGatewayCandidate.findUnique({
      where: { id },
      include: { provider: true },
    });
    return row ? toCandidateWithProvider(row) : null;
  }

  async createCandidate(data: CandidateCreateData): Promise<CandidateRecord> {
    const row = await this.prisma.modelGatewayCandidate
      .create({
        data: {
          logicalModelId: data.logicalModelId,
          providerId: data.providerId,
          providerModelId: data.providerModelId,
          catalogModelId: data.catalogModelId,
          priority: data.priority,
          timeoutMs: data.timeoutMs,
          capabilities: data.capabilities as unknown as Prisma.InputJsonValue,
          defaultParams:
            data.defaultParams === null
              ? undefined
              : (data.defaultParams as unknown as Prisma.InputJsonValue),
        },
      })
      .catch((cause: unknown) =>
        translatePersistenceError(cause, {
          conflict: ERROR_CODE.model.candidateConflict,
        }),
      );
    return toCandidate(row);
  }

  async updateCandidate(
    id: string,
    data: CandidateUpdateData,
  ): Promise<CandidateRecord> {
    const row = await this.prisma.modelGatewayCandidate
      .update({
        where: { id },
        data: {
          ...(data.providerModelId === undefined
            ? {}
            : { providerModelId: data.providerModelId }),
          ...(data.catalogModelId === undefined
            ? {}
            : { catalogModelId: data.catalogModelId }),
          ...(data.priority === undefined ? {} : { priority: data.priority }),
          ...(data.timeoutMs === undefined
            ? {}
            : { timeoutMs: data.timeoutMs }),
          ...(data.capabilities === undefined
            ? {}
            : {
                capabilities:
                  data.capabilities as unknown as Prisma.InputJsonValue,
              }),
          ...(data.defaultParams === undefined
            ? {}
            : {
                defaultParams:
                  data.defaultParams === null
                    ? Prisma.JsonNull
                    : (data.defaultParams as unknown as Prisma.InputJsonValue),
              }),
        },
      })
      .catch((cause: unknown) =>
        translatePersistenceError(cause, {
          conflict: ERROR_CODE.model.candidateConflict,
        }),
      );
    return toCandidate(row);
  }

  async setCandidateEnabled(
    id: string,
    enabled: boolean,
  ): Promise<CandidateRecord> {
    const row = await this.prisma.modelGatewayCandidate.update({
      where: { id },
      data: { enabled },
    });
    return toCandidate(row);
  }
}

function toLogical(row: LogicalModelRow): LogicalModelRecord {
  return {
    id: row.id,
    logicalKey: row.logicalKey,
    displayName: row.displayName,
    enabled: row.enabled,
    maxAttempts: row.maxAttempts,
    createdAt: row.createdAt,
  };
}

function toCandidate(row: CandidateRow): CandidateRecord {
  return {
    id: row.id,
    logicalModelId: row.logicalModelId,
    providerId: row.providerId,
    providerModelId: row.providerModelId,
    catalogModelId: row.catalogModelId,
    priority: row.priority,
    enabled: row.enabled,
    timeoutMs: row.timeoutMs,
    capabilities: parseCapabilities(row.capabilities),
    defaultParams: parseDefaultParams(row.defaultParams),
    createdAt: row.createdAt,
  };
}

function toCandidateWithProvider(
  row: CandidateWithProviderRow,
): CandidateWithProvider {
  return {
    ...toCandidate(row),
    providerSlug: row.provider.slug,
    providerEnabled: row.provider.enabled,
    providerHealth: row.provider.health as ProviderHealth,
    providerOpenUntil: row.provider.openUntil,
    providerCatalogProviderId: row.provider.catalogProviderId,
  };
}

function parseCapabilities(value: unknown): ModelCapabilities {
  const parsed = modelCapabilitiesSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error('候选能力数据损坏，无法解析');
  }
  return parsed.data;
}

function parseDefaultParams(value: unknown): DefaultModelParams | null {
  if (value === null || value === undefined) return null;
  const parsed = defaultModelParamsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
