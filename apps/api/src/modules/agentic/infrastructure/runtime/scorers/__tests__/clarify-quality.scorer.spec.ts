import { describe, expect, it } from 'vitest';
import {
  CLARIFY_QUALITY_THRESHOLD,
  clarifyQualityScorer,
} from '../clarify-quality.scorer';

const triggers = ['需要做一个导出报表功能，支持筛选'];

function draft(overrides: {
  summary: string;
  draft: Record<string, unknown>;
  questions: Array<{ question: string; options: string[] | null }>;
}) {
  return overrides;
}

describe('clarify-quality scorer', () => {
  it('完整的澄清稿得分不低于阈值', async () => {
    const result = await clarifyQualityScorer.run({
      input: { triggers },
      output: draft({
        summary: '提出人需要导出报表并支持按条件筛选。',
        draft: { goal: '导出报表', scope: '报表模块' },
        questions: [
          {
            question: '导出的字段范围包含哪些列？',
            options: ['全部列', '仅当前视图列'],
          },
        ],
      }),
    });

    expect(result.score ?? 0).toBeGreaterThanOrEqual(CLARIFY_QUALITY_THRESHOLD);
  });

  it('摘要缺失且无草稿时得低分', async () => {
    const result = await clarifyQualityScorer.run({
      input: { triggers },
      output: draft({ summary: '', draft: {}, questions: [] }),
    });

    expect(result.score ?? 0).toBeLessThan(CLARIFY_QUALITY_THRESHOLD);
  });

  it('问题不可执行时扣分', async () => {
    const complete = await clarifyQualityScorer.run({
      input: { triggers },
      output: draft({
        summary: '提出人需要导出报表并支持按条件筛选。',
        draft: { goal: '导出报表' },
        questions: [
          { question: '导出字段范围与默认筛选条件如何确定？', options: null },
        ],
      }),
    });
    const weak = await clarifyQualityScorer.run({
      input: { triggers },
      output: draft({
        summary: '提出人需要导出报表并支持按条件筛选。',
        draft: { goal: '导出报表' },
        questions: [{ question: '？', options: null }],
      }),
    });

    expect(weak.score ?? 0).toBeLessThan(complete.score ?? 0);
  });
});
