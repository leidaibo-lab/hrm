/**
 * 价格版本：一版一行，生效价 = effectiveFrom <= now 的最新一版（ADR-0015）。
 * 价格一经调用引用（ModelUsage.pricingId）即不可变，调价只能新增版本。
 */
export interface PricingRates {
  /** 输入 token 的价格。 */
  input: number;
  /** 输出 token 的价格。 */
  output: number;
  /** 缓存读取价格。 */
  cacheRead: number | null;
  /** 缓存写入价格。 */
  cacheWrite: number | null;
  /** 推理价格。 */
  reasoning: number | null;
}

/**
 * 价格版本聚合：一版一行，判定版本在给定时刻是否已生效。
 */
export class ModelPricing {
  readonly id: string;
  readonly #modelId: string;
  readonly #currency: string;
  readonly #rates: PricingRates;
  readonly #effectiveFrom: Date;

  private constructor(
    id: string,
    modelId: string,
    currency: string,
    rates: PricingRates,
    effectiveFrom: Date,
  ) {
    this.id = id;
    this.#modelId = modelId;
    this.#currency = currency;
    this.#rates = { ...rates };
    this.#effectiveFrom = new Date(effectiveFrom);
  }

  static register(props: {
    modelId: string;
    currency: string;
    rates: PricingRates;
    effectiveFrom: Date;
  }): ModelPricing {
    return new ModelPricing(
      '',
      props.modelId,
      props.currency,
      props.rates,
      props.effectiveFrom,
    );
  }

  /** 由持久化行重建（infrastructure 专用入口）。 */
  static reconstitute(row: {
    id: string;
    modelId: string;
    currency: string;
    rates: PricingRates;
    effectiveFrom: Date;
  }): ModelPricing {
    return new ModelPricing(
      row.id,
      row.modelId,
      row.currency,
      row.rates,
      row.effectiveFrom,
    );
  }

  /** 该版本在时点 at 是否已生效。 */
  isEffectiveAt(at: Date): boolean {
    return this.#effectiveFrom.getTime() <= at.getTime();
  }

  get modelId(): string {
    return this.#modelId;
  }

  get currency(): string {
    return this.#currency;
  }

  get rates(): PricingRates {
    return { ...this.#rates };
  }

  get effectiveFrom(): Date {
    return new Date(this.#effectiveFrom);
  }
}
