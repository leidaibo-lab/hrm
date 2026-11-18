import { ERROR_CODE } from '@cip/shared';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DomainError } from '../domain/domain.error';
import { ModelPricing } from '../domain/model-pricing.entity';
import {
  MODEL_PRICING_REPOSITORY,
  type ModelPricingRepository,
  type PricingVersionView,
} from '../domain/model-pricing.repository';
import {
  PROVIDER_MODEL_REPOSITORY,
  type ProviderModelRepository,
} from '../domain/provider-model.repository';

/** 价格版本服务（应用层）：一版一行，新调价新增行；被用量引用的版本不可删（ADR-0015）。 */
@Injectable()
export class ModelPricingService {
  constructor(
    @Inject(MODEL_PRICING_REPOSITORY)
    private readonly pricing: ModelPricingRepository,
    @Inject(PROVIDER_MODEL_REPOSITORY)
    private readonly models: ProviderModelRepository,
  ) {}

  async listVersions(modelId: string): Promise<PricingVersionView[]> {
    await this.ensureModel(modelId);
    return this.pricing.listByModel(modelId, new Date());
  }

  async createVersion(
    modelId: string,
    input: {
      currency: string;
      input: number;
      output: number;
      cacheRead: number | null;
      cacheWrite: number | null;
      reasoning: number | null;
      effectiveFrom: string;
    },
  ): Promise<PricingVersionView> {
    await this.ensureModel(modelId);
    return this.pricing.create(
      ModelPricing.register({
        modelId,
        currency: input.currency,
        rates: {
          input: input.input,
          output: input.output,
          cacheRead: input.cacheRead,
          cacheWrite: input.cacheWrite,
          reasoning: input.reasoning,
        },
        effectiveFrom: new Date(input.effectiveFrom),
      }),
    );
  }

  /** 删除版本；被 ModelUsage 引用时外键 Restrict 拒绝（409 in_use）。 */
  async removeVersion(versionId: string): Promise<void> {
    try {
      await this.pricing.remove(versionId);
    } catch (cause) {
      if (cause instanceof DomainError) {
        throw new ConflictException({
          code: cause.code,
          message: cause.message,
        });
      }
      throw cause;
    }
  }

  private async ensureModel(modelId: string): Promise<void> {
    const model = await this.models.findById(modelId);
    if (!model) {
      throw new NotFoundException({
        code: ERROR_CODE.model.modelNotFound,
        message: '模型不存在',
      });
    }
  }
}
