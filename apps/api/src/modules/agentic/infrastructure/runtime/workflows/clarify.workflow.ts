import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import {
  type ClarifyAgentOutput,
  clarifyOutputSchema,
} from '../agents/clarify.agent';
import { CLARIFY_QUALITY_THRESHOLD } from '../scorers/clarify-quality.scorer';

/** 澄清工作流输入：工单与线程主键。 */
export const clarifyWorkflowInputSchema = z.object({
  /** 工单主键。 */
  ticketId: z.string().min(1),
  /** 线程主键。 */
  threadId: z.string().min(1),
});

/** 上下文装载结果：序列化后的提示词与角色标识。 */
export const clarifyContextSchema = z.object({
  /** 工单主键。 */
  ticketId: z.string(),
  /** 线程主键。 */
  threadId: z.string(),
  /** 发给角色的提示词。 */
  prompt: z.string(),
});

/** 评分后的澄清稿：质量分与人工分支标记。 */
export const clarifyScoredSchema = clarifyOutputSchema.extend({
  /** 质量分，0–1。 */
  score: z.number(),
  /** 是否进入人工分支。 */
  needsHuman: z.boolean(),
});

/** 澄清工作流输出：草稿、评分与分支路由。 */
export const clarifyWorkflowOutputSchema = clarifyScoredSchema.extend({
  /** 分支路由：attention 写入关注并结束，persist 落产物。 */
  route: z.enum(['attention', 'persist']),
});

/**
 * 读取分支输出：Mastra 的 branch 结果按分支步骤 id 包装，这里统一取首个分支值。
 * 兼容已是拍平输出（含 route）的情况。
 */
export function toClarifyBranchOutput(
  value: unknown,
): z.infer<typeof clarifyWorkflowOutputSchema> | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.route === 'string')
    return record as z.infer<typeof clarifyWorkflowOutputSchema>;
  const first = Object.values(record)[0];
  if (first && typeof first === 'object' && 'route' in first)
    return first as z.infer<typeof clarifyWorkflowOutputSchema>;
  return null;
}

/** 澄清工作流依赖：由 runtime 适配器注入，测试可替换。 */
export interface ClarifyWorkflowDeps {
  /** 装载线程、事件与策略上下文。 */
  loadContext(input: { ticketId: string; threadId: string }): Promise<{
    ticketId: string;
    threadId: string;
    prompt: string;
  }>;
  /** 调用澄清角色生成结构化草稿。 */
  generate(
    context: z.infer<typeof clarifyContextSchema>,
  ): Promise<ClarifyAgentOutput>;
  /** 对草稿评分。 */
  score(draft: ClarifyAgentOutput): Promise<number>;
}

/**
 * 澄清工作流：装载上下文 → 角色出稿 → 校验 → 评分 → 按阈值分支。
 * 低分进入 attention 分支，只写关注并结束本次 run；达标进入 persist 分支落产物。
 */
export function createClarifyWorkflow(deps: ClarifyWorkflowDeps) {
  const loadContext = createStep({
    id: 'load-context',
    inputSchema: clarifyWorkflowInputSchema,
    outputSchema: clarifyContextSchema,
    execute: async ({ inputData }) => deps.loadContext(inputData),
  });

  const generateDraft = createStep({
    id: 'generate-draft',
    inputSchema: clarifyContextSchema,
    outputSchema: clarifyOutputSchema,
    execute: async ({ inputData }) => deps.generate(inputData),
  });

  const validateDraft = createStep({
    id: 'validate-draft',
    inputSchema: clarifyOutputSchema,
    outputSchema: clarifyOutputSchema,
    execute: async ({ inputData }) => ({
      summary: inputData.summary.trim(),
      draft: inputData.draft,
      questions: inputData.questions.slice(0, 5),
    }),
  });

  const scoreQuality = createStep({
    id: 'score-quality',
    inputSchema: clarifyOutputSchema,
    outputSchema: clarifyScoredSchema,
    execute: async ({ inputData }) => {
      const score = await deps.score(inputData);
      return {
        ...inputData,
        score,
        needsHuman: score < CLARIFY_QUALITY_THRESHOLD,
      };
    },
  });

  const raiseAttention = createStep({
    id: 'raise-attention',
    inputSchema: clarifyScoredSchema,
    outputSchema: clarifyWorkflowOutputSchema,
    execute: async ({ inputData }) => ({
      ...inputData,
      route: 'attention' as const,
    }),
  });

  const persistArtifact = createStep({
    id: 'persist-artifact',
    inputSchema: clarifyScoredSchema,
    outputSchema: clarifyWorkflowOutputSchema,
    execute: async ({ inputData }) => ({
      ...inputData,
      route: 'persist' as const,
    }),
  });

  return createWorkflow({
    id: 'clarify',
    inputSchema: clarifyWorkflowInputSchema,
    outputSchema: clarifyWorkflowOutputSchema,
  })
    .then(loadContext)
    .then(generateDraft)
    .then(validateDraft)
    .then(scoreQuality)
    .branch([
      [async ({ inputData }) => inputData.needsHuman, raiseAttention],
      [async ({ inputData }) => !inputData.needsHuman, persistArtifact],
    ])
    .commit();
}
