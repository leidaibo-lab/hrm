import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { RecallPort } from '../../../domain/recall.port';

/** 相似召回工具的依赖。 */
export interface SearchSimilarToolDeps {
  /** 召回用例。 */
  recall: RecallPort;
  /** 允许召回的 scopeKey；设置后只召回同范围线程。 */
  scopeKey?: string | null;
  /** 工具级有效权限校验；缺省不校验（仅测试/系统内部）。 */
  authorize?: (tool: string) => Promise<boolean>;
}

/** 召回结果项 schema。 */
const similarItemSchema = z.object({
  /** 相似线程主键。 */
  threadId: z.string(),
  /** 线程摘要；未生成摘要时为 null。 */
  summary: z.string().nullable(),
  /** 相似度分数，0–1。 */
  score: z.number(),
  /** 命中文本片段。 */
  snippet: z.string(),
});

/** 召回结果 schema。 */
const searchSimilarOutputSchema = z.object({
  /** 相似线程列表，按分数倒序。 */
  items: z.array(similarItemSchema).max(10),
  /** 本次召回模式：semantic 或 lexical。 */
  mode: z.enum(['semantic', 'lexical']),
});

/**
 * 相似历史召回工具：委托 application 召回用例，词面预筛 + 语义重排。
 * 工具只读、幂等；语义失败由召回用例内部降级。
 */
export function createSearchSimilarTool(deps: SearchSimilarToolDeps) {
  return createTool({
    id: 'search-similar',
    description: '按文本相似度召回最近线程，最多返回 10 条。',
    inputSchema: z.object({
      /** 查询文本。 */
      query: z.string().min(1),
      /** 返回条数上限。 */
      limit: z.number().int().min(1).max(10).default(5),
      /** 需要排除的线程主键。 */
      excludeThreadId: z.string().optional(),
    }),
    outputSchema: searchSimilarOutputSchema,
    execute: async ({ query, limit, excludeThreadId }) => {
      if (deps.authorize && !(await deps.authorize('search-similar')))
        throw new Error('工具权限不足：search-similar');
      return deps.recall.search({
        query,
        limit,
        ...(excludeThreadId ? { excludeThreadId } : {}),
        ...(deps.scopeKey ? { scopeKey: deps.scopeKey } : {}),
      });
    },
  });
}
