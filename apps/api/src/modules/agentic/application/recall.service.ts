import { Inject, Injectable, Optional } from '@nestjs/common';
import type {
  RecallInput,
  RecallItem,
  RecallPort,
  RecallResult,
} from '../domain/recall.port';
import {
  SEMANTIC_RECALL,
  type SemanticRecallPort,
} from '../domain/semantic-recall.port';
import {
  THREAD_REPOSITORY,
  type ThreadRepository,
} from '../domain/thread.repository';
import {
  TRIGGER_REPOSITORY,
  type TriggerRepository,
} from '../domain/trigger.repository';

/** 单次召回的最大候选数。 */
const CANDIDATE_LIMIT = 10;

/**
 * 相似历史召回：词面预筛 + 可选模型语义重排。
 * 语义端口不可用或失败时保持词面结果，不阻断调用方。
 */
@Injectable()
export class RecallService implements RecallPort {
  constructor(
    @Inject(THREAD_REPOSITORY) private readonly threads: ThreadRepository,
    @Inject(TRIGGER_REPOSITORY) private readonly triggers: TriggerRepository,
    @Optional()
    @Inject(SEMANTIC_RECALL)
    private readonly semantic?: SemanticRecallPort,
  ) {}

  /** 按查询召回相似线程。 */
  async search(input: RecallInput): Promise<RecallResult> {
    const threads = await this.threads.list(50);
    const items: RecallItem[] = [];
    const texts = new Map<string, string>();
    for (const thread of threads) {
      if (thread.id === input.excludeThreadId) continue;
      if (input.scopeKey && thread.scopeKey !== input.scopeKey) continue;
      const triggers = await this.triggers.listByThread(thread.id, 3);
      const text = triggers.map((trigger) => trigger.text).join('\n');
      const score = toOverlapScore(input.query, text);
      if (score <= 0) continue;
      texts.set(thread.id, text);
      items.push({
        threadId: thread.id,
        summary: thread.summary,
        score,
        snippet: text.slice(0, 200),
      });
    }
    items.sort((left, right) => right.score - left.score);
    const candidates = items.slice(0, CANDIDATE_LIMIT);
    let mode: 'semantic' | 'lexical' = 'lexical';
    if (this.semantic && candidates.length > 1) {
      const scores = await this.semantic.rank({
        query: input.query,
        candidates: candidates.map((item) => ({
          id: item.threadId,
          text: texts.get(item.threadId) ?? item.snippet,
        })),
      });
      if (scores) {
        for (const item of candidates) {
          const semanticScore = scores[item.threadId];
          if (semanticScore !== undefined) item.score = semanticScore;
        }
        candidates.sort((left, right) => right.score - left.score);
        mode = 'semantic';
      }
    }
    return { items: candidates.slice(0, input.limit), mode };
  }
}

/** 按查询词命中比例计算轻量相似度，0–1。 */
function toOverlapScore(query: string, text: string): number {
  const tokens = query
    .split(/[\s,，。;；:：/\\|]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
  if (tokens.length === 0 || !text) return 0;
  const hits = tokens.filter((token) => text.includes(token)).length;
  return hits / tokens.length;
}
