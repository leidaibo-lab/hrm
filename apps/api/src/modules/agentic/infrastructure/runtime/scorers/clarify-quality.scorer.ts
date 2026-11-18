import { createScorer } from '@mastra/core/evals';
import { z } from 'zod';

/** 澄清稿评分输入：需求事件文本。 */
const clarifyScoreInputSchema = z.object({
  /** 事件文本批次，用于判断覆盖度。 */
  triggers: z.array(z.string()),
});

/** 澄清稿评分输出：与澄清角色输出一致。 */
const clarifyScoreOutputSchema = z.object({
  /** 摘要。 */
  summary: z.string(),
  /** 结构化草稿。 */
  draft: z.record(z.string(), z.unknown()),
  /** 待确认问题。 */
  questions: z.array(
    z.object({
      /** 问题文本。 */
      question: z.string(),
      /** 可选答案。 */
      options: z.array(z.string()).nullable(),
    }),
  ),
});

/**
 * 澄清稿质量评分：只用确定性规则，不调用模型。
 * 摘要与草稿覆盖度决定基线，问题可执行性加分；分数 < 0.7 进入人工分支。
 */
export const clarifyQualityScorer = createScorer({
  id: 'clarify-quality',
  description: '澄清稿质量：摘要完整、草稿非空、问题可执行',
  type: {
    input: clarifyScoreInputSchema,
    output: clarifyScoreOutputSchema,
  },
}).generateScore(({ run }) => {
  const summary = run.output.summary.trim();
  const draftKeys = Object.keys(run.output.draft ?? {});
  const questions = run.output.questions ?? [];

  let score = 0;
  if (summary.length >= 10) score += 0.3;
  if (draftKeys.length > 0) score += 0.3;
  if (questions.length === 0) {
    // 没有问题时，摘要与草稿需要足够完整才算达标。
    score += summary.length >= 20 && draftKeys.length > 0 ? 0.4 : 0.1;
  } else {
    const actionable = questions.filter(
      (question) => question.question.trim().length >= 8,
    );
    score += (actionable.length / questions.length) * 0.3;
    if (
      new Set(questions.map((item) => item.question.trim())).size ===
      questions.length
    )
      score += 0.1;
  }
  return Math.min(1, Math.max(0, Number(score.toFixed(2))));
});

/** 澄清稿最低交付分；低于该分数进入人工分支。 */
export const CLARIFY_QUALITY_THRESHOLD = 0.7;
