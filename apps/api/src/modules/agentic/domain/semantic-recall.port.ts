/** 语义召回候选：线程标识与用于打分的文本。 */
export interface SemanticRecallCandidate {
  /** 线程主键。 */
  id: string;
  /** 候选文本；调用方负责截断。 */
  text: string;
}

/** 语义召回端口：按查询对候选打分，不可用时返回 null 由词面召回降级。 */
export interface SemanticRecallPort {
  /** 返回 id → 0–1 分数；不可用/失败返回 null。 */
  rank(input: {
    query: string;
    candidates: SemanticRecallCandidate[];
  }): Promise<Record<string, number> | null>;
}

/** 语义召回端口的 DI 令牌。 */
export const SEMANTIC_RECALL = Symbol('SEMANTIC_RECALL');
