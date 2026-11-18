/** 汇率仓储注入令牌。 */
export const FX_REPOSITORY = Symbol('FX_REPOSITORY');

/** 汇率版本记录：rateToBase 表示 1 单位原币折合多少 USD。 */
export interface FxRecord {
  /** 记录标识。 */
  id: string;
  /** 基准币种。 */
  baseCurrency: string;
  /** 报价币种。 */
  quoteCurrency: string;
  /** 折算到基准币种的汇率。 */
  rateToBase: string;
  /** 生效时间。 */
  effectiveFrom: Date;
  /** 来源。 */
  source: 'manual';
  /** 创建时间。 */
  createdAt: Date;
}

/** 汇率新建输入。 */
export interface FxCreateData {
  /** 报价币种。 */
  quoteCurrency: string;
  /** 折算到基准币种的汇率。 */
  rateToBase: string;
  /** 生效时间。 */
  effectiveFrom: Date;
}

/** 汇率仓储端口：只追加。 */
export interface FxRepository {
  /** 列出记录。 */
  list(): Promise<FxRecord[]>;
  /** 创建记录并返回结果。 */
  create(data: FxCreateData): Promise<FxRecord>;
  /** 取指定币种在时点前最新一版汇率；无则 null。 */
  findEffective(currency: string, at: Date): Promise<FxRecord | null>;
}
