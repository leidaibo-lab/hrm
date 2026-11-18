import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma';
import { ModelPricing } from '../domain/model-pricing.entity';
import {
  type ModelPricingRepository,
  type PricingVersionView,
} from '../domain/model-pricing.repository';
import { toPersistenceError } from './model-persistence.helper';

/** ModelPricingRepository 的 Prisma 实现：金额以 Decimal 字符串出仓，禁止 float。 */
@Injectable()
export class ModelPricingPrismaRepository implements ModelPricingRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async listByModel(modelId: string, now: Date): Promise<PricingVersionView[]> {
    const rows = await this.prisma.modelPricing.findMany({
      where: { modelId },
      orderBy: { effectiveFrom: 'desc' },
    });
    // 生效状态：最新一条已生效的为 active，其前（时间更晚）为 pending，其余为 history
    let activeAssigned = false;
    return rows.map((row) => {
      let status: PricingVersionView['status'];
      if (row.effectiveFrom.getTime() > now.getTime()) {
        status = 'pending';
      } else if (!activeAssigned) {
        status = 'active';
        activeAssigned = true;
      } else {
        status = 'history';
      }
      return this.toVersionView(row, status);
    });
  }

  async findEffectiveAt(
    modelId: string,
    at: Date,
  ): Promise<ModelPricing | null> {
    const row = await this.prisma.modelPricing.findFirst({
      where: { modelId, effectiveFrom: { lte: at } },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!row) return null;
    return ModelPricing.reconstitute({
      id: row.id,
      modelId: row.modelId,
      currency: row.currency,
      rates: this.toRates(row),
      effectiveFrom: row.effectiveFrom,
    });
  }

  async create(pricing: ModelPricing): Promise<PricingVersionView> {
    const row = await this.prisma.modelPricing.create({
      data: {
        modelId: pricing.modelId,
        currency: pricing.currency,
        input: pricing.rates.input,
        output: pricing.rates.output,
        cacheRead: pricing.rates.cacheRead,
        cacheWrite: pricing.rates.cacheWrite,
        reasoning: pricing.rates.reasoning,
        effectiveFrom: pricing.effectiveFrom,
      },
    });
    return this.toVersionView(
      row,
      row.effectiveFrom.getTime() > Date.now() ? 'pending' : 'active',
    );
  }

  async remove(id: string): Promise<void> {
    await this.prisma.modelPricing.delete({ where: { id } }).catch((cause) => {
      throw toPersistenceError(cause);
    });
  }

  private toRates(row: {
    input: PrismaDecimalLike;
    output: PrismaDecimalLike;
    cacheRead: PrismaDecimalLike | null;
    cacheWrite: PrismaDecimalLike | null;
    reasoning: PrismaDecimalLike | null;
  }): {
    input: number;
    output: number;
    cacheRead: number | null;
    cacheWrite: number | null;
    reasoning: number | null;
  } {
    return {
      input: Number(row.input),
      output: Number(row.output),
      cacheRead: row.cacheRead === null ? null : Number(row.cacheRead),
      cacheWrite: row.cacheWrite === null ? null : Number(row.cacheWrite),
      reasoning: row.reasoning === null ? null : Number(row.reasoning),
    };
  }

  private toVersionView(
    row: {
      id: string;
      modelId: string;
      currency: string;
      input: PrismaDecimalLike;
      output: PrismaDecimalLike;
      cacheRead: PrismaDecimalLike | null;
      cacheWrite: PrismaDecimalLike | null;
      reasoning: PrismaDecimalLike | null;
      effectiveFrom: Date;
      createdAt: Date;
    },
    status: PricingVersionView['status'],
  ): PricingVersionView {
    return {
      id: row.id,
      modelId: row.modelId,
      currency: row.currency,
      input: row.input.toString(),
      output: row.output.toString(),
      cacheRead: row.cacheRead?.toString() ?? null,
      cacheWrite: row.cacheWrite?.toString() ?? null,
      reasoning: row.reasoning?.toString() ?? null,
      effectiveFrom: row.effectiveFrom.toISOString(),
      status,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

interface PrismaDecimalLike {
  toString(): string;
}
