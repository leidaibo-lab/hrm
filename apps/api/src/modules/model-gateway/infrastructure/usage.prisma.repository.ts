import type { TableQueryRequest } from '@cip/shared';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma';
import { Prisma } from '../../../platform/prisma/generated/client';
import {
  buildTableOrderBy,
  buildTableWhere,
  tablePageArgs,
} from '../../../platform/table-query';
import {
  type UsageItemView,
  type UsagePriceSource,
  type UsageRecordData,
  type UsageRepository,
  type UsageStatus,
  type UsageSummaryFilter,
  type UsageSummaryView,
  type UsageTableResult,
} from '../domain/usage.repository';

interface UsageRow {
  id: string;
  callId: string;
  traceId: string | null;
  caller: string | null;
  logicalModel: { logicalKey: string };
  candidateId: string;
  candidate: { providerModelId: string; provider: { slug: string } };
  spaceId: string | null;
  agentKey: string | null;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number;
  priceSource: string;
  currency: string | null;
  costOriginal: { toString(): string } | null;
  cost: { toString(): string } | null;
  fxMissing: boolean;
  status: string;
  errorCode: string | null;
  latencyMs: number | null;
  createdAt: Date;
}

/** UsageRepository 的 Prisma 实现：只读报表；items/total/meta 同条件。 */
@Injectable()
export class UsagePrismaRepository implements UsageRepository {
  /** 展示字段 → 存储列绑定：logicalKey 经关系过滤，成本与延迟只排序。 */
  private static readonly bindings = {
    createdAt: { type: 'column', column: 'createdAt' },
    cost: { type: 'column', column: 'cost', nullable: true },
    latencyMs: { type: 'column', column: 'latencyMs', nullable: true },
    candidateId: { type: 'column', column: 'candidateId' },
    spaceId: { type: 'column', column: 'spaceId', nullable: true },
    agentKey: { type: 'column', column: 'agentKey', nullable: true },
    status: { type: 'column', column: 'status' },
    logicalKey: {
      type: 'custom',
      filter: (
        operator: string,
        payload: { value?: string | number; values?: string[] },
      ) => {
        const equals = {
          logicalModel: { logicalKey: { equals: String(payload.value ?? '') } },
        };
        return operator === 'neq' ? { NOT: equals } : equals;
      },
    },
  } as const;

  private static readonly qColumns = [
    'traceId',
    'caller',
    'spaceId',
    'agentKey',
  ] as const;

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async create(data: UsageRecordData): Promise<void> {
    await this.prisma.modelGatewayUsage.create({
      data: {
        callId: data.callId,
        traceId: data.traceId,
        caller: data.caller,
        logicalModelId: data.logicalModelId,
        candidateId: data.candidateId,
        spaceId: data.spaceId,
        agentKey: data.agentKey,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        cacheReadTokens: data.cacheReadTokens,
        cacheWriteTokens: data.cacheWriteTokens,
        reasoningTokens: data.reasoningTokens,
        priceId: data.priceId,
        priceSource: data.priceSource,
        currency: data.currency,
        costOriginal: data.costOriginal,
        cost: data.cost,
        fxRate: data.fxRate,
        fxRateId: data.fxRateId,
        fxMissing: data.fxMissing,
        status: data.status,
        errorCode: data.errorCode,
        latencyMs: data.latencyMs,
      },
    });
  }

  async queryTable(query: TableQueryRequest): Promise<UsageTableResult> {
    const where = buildTableWhere(
      query,
      UsagePrismaRepository.bindings,
      null,
      UsagePrismaRepository.qColumns,
    ) as unknown as Prisma.ModelGatewayUsageWhereInput;
    const [rows, total, meta] = await this.prisma.$transaction(
      async (transaction) =>
        Promise.all([
          transaction.modelGatewayUsage.findMany({
            where,
            orderBy: buildTableOrderBy(
              query,
              UsagePrismaRepository.bindings,
            ) as unknown as Prisma.ModelGatewayUsageOrderByWithRelationInput[],
            ...tablePageArgs(query),
            include: {
              logicalModel: { select: { logicalKey: true } },
              candidate: {
                select: {
                  providerModelId: true,
                  provider: { select: { slug: true } },
                },
              },
            },
          }),
          transaction.modelGatewayUsage.count({ where }),
          this.summarizeWhere(where, transaction),
        ]),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return {
      total,
      items: rows.map((row) => toItemView(row)),
      meta,
    };
  }

  async summarize(filter: UsageSummaryFilter): Promise<UsageSummaryView> {
    const where = filterToWhere(filter);
    return this.summarizeWhere(where, this.prisma);
  }

  private async summarizeWhere(
    where: Prisma.ModelGatewayUsageWhereInput,
    client: Prisma.TransactionClient | PrismaService,
  ): Promise<UsageSummaryView> {
    const [grouped, missingPriceCount, missingFxCount] = await Promise.all([
      client.modelGatewayUsage.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
        _sum: { inputTokens: true, outputTokens: true, cost: true },
      }),
      client.modelGatewayUsage.count({
        where: { AND: [where, { priceSource: 'missing', status: 'success' }] },
      }),
      client.modelGatewayUsage.count({
        where: { AND: [where, { fxMissing: true, status: 'success' }] },
      }),
    ]);
    const summary: UsageSummaryView = {
      totalCalls: 0,
      successCount: 0,
      failedCount: 0,
      rateLimitedCount: 0,
      cancelledCount: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: null,
      missingPriceCount,
      missingFxCount,
    };
    let totalCost = new Prisma.Decimal(0);
    let hasCost = false;
    for (const group of grouped) {
      summary.totalCalls += group._count._all;
      summary.totalInputTokens += group._sum.inputTokens ?? 0;
      summary.totalOutputTokens += group._sum.outputTokens ?? 0;
      if (group._sum.cost !== null && group._sum.cost !== undefined) {
        totalCost = totalCost.plus(group._sum.cost);
        hasCost = true;
      }
      if (group.status === 'success') summary.successCount = group._count._all;
      if (group.status === 'failed') summary.failedCount = group._count._all;
      if (group.status === 'rate_limited') {
        summary.rateLimitedCount = group._count._all;
      }
      if (group.status === 'cancelled') {
        summary.cancelledCount = group._count._all;
      }
    }
    summary.totalCost = hasCost ? totalCost.toFixed(8) : null;
    return summary;
  }
}

function filterToWhere(
  filter: UsageSummaryFilter,
): Prisma.ModelGatewayUsageWhereInput {
  const AND: Prisma.ModelGatewayUsageWhereInput[] = [];
  if (filter.spaceId) AND.push({ spaceId: filter.spaceId });
  if (filter.agentKey) AND.push({ agentKey: filter.agentKey });
  if (filter.logicalKey) {
    AND.push({ logicalModel: { logicalKey: filter.logicalKey } });
  }
  if (filter.from || filter.to) {
    AND.push({
      createdAt: {
        ...(filter.from ? { gte: new Date(filter.from) } : {}),
        ...(filter.to ? { lte: new Date(filter.to) } : {}),
      },
    });
  }
  return AND.length ? { AND } : {};
}

function toItemView(row: UsageRow): UsageItemView {
  return {
    id: row.id,
    callId: row.callId,
    traceId: row.traceId,
    caller: row.caller,
    logicalKey: row.logicalModel.logicalKey,
    modelName: row.logicalModel.logicalKey,
    candidateId: row.candidateId,
    providerSlug: row.candidate.provider.slug,
    providerModelId: row.candidate.providerModelId,
    spaceId: row.spaceId,
    agentKey: row.agentKey,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    cacheReadTokens: row.cacheReadTokens,
    cachedInputTokens: row.cacheReadTokens,
    cacheWriteTokens: row.cacheWriteTokens,
    reasoningTokens: row.reasoningTokens,
    priceSource: row.priceSource as UsagePriceSource,
    currency: row.currency,
    costOriginal: row.costOriginal?.toString() ?? null,
    cost: row.cost?.toString() ?? null,
    fxMissing: row.fxMissing,
    status: row.status as UsageStatus,
    errorCode: row.errorCode,
    latencyMs: row.latencyMs,
    createdAt: row.createdAt.toISOString(),
  };
}
