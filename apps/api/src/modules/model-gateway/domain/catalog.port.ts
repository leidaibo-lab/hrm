/** 外部模型目录端口注入令牌：models.dev 仅由后台同步任务访问。 */
export const CATALOG_PORT = Symbol('CATALOG_PORT');

/** 目录模型：价格单位 USD / 每百万 token；上游未收录为 null。 */
export interface CatalogModel {
  /** 模型标识。 */
  modelId: string;
  /** 展示名称。 */
  displayName: string;
  /** 是否支持推理能力。 */
  reasoning: boolean;
  /** 是否支持工具调用。 */
  toolCall: boolean;
  /** 是否支持结构化输出。 */
  structuredOutput: boolean;
  /** 是否支持图像输入。 */
  imageInput: boolean;
  /** 上下文窗口大小。 */
  contextWindow: number | null;
  /** 最大输出 token 数。 */
  maxOutputTokens: number | null;
  /** 输入 token 的价格。 */
  input: number | null;
  /** 输出 token 的价格。 */
  output: number | null;
  /** 缓存读取价格。 */
  cacheRead: number | null;
  /** 缓存写入价格。 */
  cacheWrite: number | null;
  /** 推理价格。 */
  reasoningPrice: number | null;
}

/** 目录供应商。 */
export interface CatalogProvider {
  /** 供应商标识。 */
  providerId: string;
  /** 名称。 */
  name: string;
  /** 模型集合。 */
  models: CatalogModel[];
}

/** 外部模型目录端口：调用链路不访问外网，仅同步任务使用。 */
export interface CatalogPort {
  /** 拉取全量目录；上游不可达时抛错，由应用层翻译为 503。 */
  fetchCatalog(): Promise<CatalogProvider[]>;
}
