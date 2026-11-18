import type { TableQueryRequest } from '@cip/shared';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma';
import { Prisma } from '../../../platform/prisma/generated/client';
import {
  buildTableOrderBy,
  buildTableWhere,
  tablePageArgs,
} from '../../../platform/table-query';
import type {
  ModelUsageRepository,
  UsageItemView,
  UsageRecord,
  UsageSummaryView,
  UsageTableResult,
} from '../domain/model-usage.repository';

/** ModelUsageRepository 的 Prisma 实现：只增不改；报表用 offset 分页 + 汇总聚合。 */
@Injectable()
export class ModelUsagePrismaRepository implements ModelUsageRepository {
  /** 展示字段 → 存储列绑定：cost/latencyMs 只排序不筛选。 */
  private static readonly bindings = {
    createdAt: { type: 'column', column: 'createdAt' },
    cost: { type: 'column', column: 'cost', nullable: true },
    latencyMs: { type: 'column', column: 'latencyMs', nullable: true },
    modelId: { type: 'column', column: 'modelId' },
    caller: { type: 'column', column: 'caller', nullable: true },
    status: { type: 'column', column: 'status' },
  } as const;

  private static readonly qColumns = ['caller', 'traceId'] as const;

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async create(record: UsageRecord): Promise<void> {
    await this.prisma.modelUsage.create({
      data: {
        modelId: record.modelId,
        pricingId: record.pricingId,
        inputTokens: record.inputTokens,
        outputTokens: record.outputTokens,
        reasoningTokens: record.reasoningTokens,
        cachedInputTokens: record.cachedInputTokens,
        cacheWriteTokens: record.cacheWriteTokens,
        cost: record.cost,
        latencyMs: record.latencyMs,
        status: record.status,
        caller: record.caller,
        traceId: record.traceId,
      },
    });
  }

  async queryTable(query: TableQueryRequest): Promise<UsageTableResult> {
    const where = buildTableWhere(
      query,
      ModelUsagePrismaRepository.bindings,
      null,
      ModelUsagePrismaRepository.qColumns,
    ) as Prisma.ModelUsageWhereInput;
    const [rows, total, grouped] = await this.prisma.$transaction(
      async (transaction) =>
        Promise.all([
          transaction.modelUsage.findMany({
            where,
            orderBy: buildTableOrderBy(
              query,
              ModelUsagePrismaRepository.bindings,
            ) as Prisma.ModelUsageOrderByWithRelationInput[],
            ...tablePageArgs(query),
            include: {
              model: {
                select: {
                  displayName: true,
                  provider: { select: { slug: true } },
                },
              },
            },
          }),
          transaction.modelUsage.count({ where }),
          this.summarizeWhere(where, transaction),
        ]),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return {
      total,
      items: rows.map((row) => this.toItemView(row)),
      meta: grouped,
    };
  }

  /** 相同筛选条件的汇总（meta 与 items 同范围；）。 */
  private async summarizeWhere(
    where: Prisma.ModelUsageWhereInput,
    transaction: Prisma.TransactionClient,
  ): Promise<UsageSummaryView> {
    const grouped = await transaction.modelUsage.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
      _sum: { inputTokens: true, outputTokens: true, cost: true },
    });
    const summary: UsageSummaryView = {
      totalCalls: 0,
      successCount: 0,
      failedCount: 0,
      rateLimitedCount: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: null,
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
    }
    summary.totalCost = hasCost ? totalCost.toFixed(8) : null;
    return summary;
  }

  private toItemView(row: {
    id: string;
    modelId: string;
    model: { displayName: string; provider: { slug: string } };
    inputTokens: number;
    outputTokens: number;
    reasoningTokens: number;
    cachedInputTokens: number;
    cacheWriteTokens: number;
    cost: { toString(): string } | null;
    latencyMs: number | null;
    status: UsageItemView['status'];
    caller: string | null;
    traceId: string | null;
    createdAt: Date;
  }): UsageItemView {
    return {
      id: row.id,
      modelId: row.modelId,
      modelName: row.model.displayName,
      providerSlug: row.model.provider.slug,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      reasoningTokens: row.reasoningTokens,
      cachedInputTokens: row.cachedInputTokens,
      cacheWriteTokens: row.cacheWriteTokens,
      cost: row.cost === null ? null : row.cost.toString(),
      latencyMs: row.latencyMs,
      status: row.status,
      caller: row.caller,
      traceId: row.traceId,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
