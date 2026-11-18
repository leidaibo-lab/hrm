import type { PriceSource } from './price.entity';

/** 价格仓储注入令牌。 */
export const PRICE_REPOSITORY = Symbol('PRICE_REPOSITORY');

/** 价格版本记录：金额以 8 位小数字符串进出，禁止 float 中转。 */
export interface PriceRecord {
  /** 记录标识。 */
  id: string;
  /** 候选项标识。 */
  candidateId: string;
  /** 来源。 */
  source: PriceSource;
  /** 币种。 */
  currency: string;
  /** 输入 token 的价格。 */
  input: string;
  /** 输出 token 的价格。 */
  output: string;
  /** 缓存读取价格。 */
  cacheRead: string | null;
  /** 缓存写入价格。 */
  cacheWrite: string | null;
  /** 推理价格。 */
  reasoning: string | null;
  /** 生效时间。 */
  effectiveFrom: Date;
  /** 获取时间。 */
  fetchedAt: Date | null;
  /** 创建时间。 */
  createdAt: Date;
}

/** 价格版本展示状态：由应用层按当前时间推导。 */
export interface PriceVersionView extends PriceRecord {
  /** 状态。 */
  status: 'active' | 'pending' | 'history';
}

/** 手动价格新建输入。 */
export interface ManualPriceCreateData {
  /** 候选项标识。 */
  candidateId: string;
  /** 币种。 */
  currency: string;
  /** 输入 token 的价格。 */
  input: string;
  /** 输出 token 的价格。 */
  output: string;
  /** 缓存读取价格。 */
  cacheRead: string | null;
  /** 缓存写入价格。 */
  cacheWrite: string | null;
  /** 推理价格。 */
  reasoning: string | null;
  /** 生效时间。 */
  effectiveFrom: Date;
}

/** 目录价格写入输入：来源固定 models_dev，费率未变时跳过。 */
export interface CatalogPriceData {
  /** 候选项标识。 */
  candidateId: string;
  /** 币种。 */
  currency: string;
  /** 输入 token 的价格。 */
  input: string;
  /** 输出 token 的价格。 */
  output: string;
  /** 缓存读取价格。 */
  cacheRead: string | null;
  /** 缓存写入价格。 */
  cacheWrite: string | null;
  /** 推理价格。 */
  reasoning: string | null;
  /** 获取时间。 */
  fetchedAt: Date;
}

/** 价格仓储端口：只追加；应用层负责版本语义。 */
export interface PriceRepository {
  /** 列出指定候选项的价格。 */
  listByCandidate(candidateId: string): Promise<PriceRecord[]>;
  /** 列出全部记录。 */
  findAll(): Promise<PriceRecord[]>;
  /** 按标识查询记录，不存在时返回空值。 */
  findById(id: string): Promise<PriceRecord | null>;
  /** 创建人工维护的价格记录。 */
  createManual(data: ManualPriceCreateData): Promise<PriceRecord>;
  /** 记录目录价格；无需写入时返回空值。 */
  recordCatalog(data: CatalogPriceData): Promise<PriceRecord | null>;
  /** 删除指定记录。 */
  remove(id: string): Promise<void>;
}
