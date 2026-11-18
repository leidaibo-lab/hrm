/** 相似召回输入。 */
export interface RecallInput {
  /** 查询文本。 */
  query: string;
  /** 返回条数上限。 */
  limit: number;
  /** 排除的线程主键。 */
  excludeThreadId?: string;
  /** 仅召回该范围；缺省不限。 */
  scopeKey?: string | null;
}

/** 召回结果项。 */
export interface RecallItem {
  /** 线程主键。 */
  threadId: string;
  /** 线程摘要。 */
  summary: string | null;
  /** 相似度分数，0–1。 */
  score: number;
  /** 命中文本片段。 */
  snippet: string;
}

/** 召回结果。 */
export interface RecallResult {
  /** 相似线程，按分数倒序。 */
  items: RecallItem[];
  /** 本次召回模式。 */
  mode: 'semantic' | 'lexical';
}

/** 相似召回端口：application 实现，runtime 工具依赖该契约。 */
export interface RecallPort {
  /** 按查询召回相似线程。 */
  search(input: RecallInput): Promise<RecallResult>;
}

/** 相似召回端口的 DI 令牌。 */
export const RECALL_PORT = Symbol('RECALL_PORT');
