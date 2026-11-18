/** 注入令牌：application 以 token 依赖，infrastructure 以 useClass 实现。 */
export const CATALOG_PORT = Symbol('CATALOG_PORT');

/** 目录模型读模型：models.dev 基线字段，与 HTTP 契约（DTO）解耦。 */
export interface CatalogModelView {
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
  /** USD / 每百万 token；上游未收录为 null。 */
  input: number | null;
  /** 输出 token 的价格。 */
  output: number | null;
  /** 缓存读取价格。 */
  cacheRead: number | null;
  /** 缓存写入价格。 */
  cacheWrite: number | null;
}

/** 目录供应商读模型：导入向导的基线数据，价格单位 USD / 每百万 token。 */
export interface CatalogProviderView {
  /** 供应商标识。 */
  providerId: string;
  /** 名称。 */
  name: string;
  /** 服务地址。 */
  baseUrl: string | null;
  /** 模型集合。 */
  models: CatalogModelView[];
}

/** 外部模型目录端口：models.dev 数据源，仅作导入向导基线，计费事实源仍是平台自有表。 */
export interface CatalogPort {
  /** 拉取全量目录；上游不可达时抛错，由应用层翻译为 503。 */
  fetchCatalog(): Promise<CatalogProviderView[]>;
}
