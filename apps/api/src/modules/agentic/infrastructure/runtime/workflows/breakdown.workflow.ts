import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import {
  type BreakdownAgentOutput,
  breakdownOutputSchema,
} from '../agents/breakdown.agent';

/** 拆解工作流输入：工单与线程主键。 */
export const breakdownWorkflowInputSchema = z.object({
  /** 工单主键。 */
  ticketId: z.string().min(1),
  /** 线程主键。 */
  threadId: z.string().min(1),
});

/** 上下文装载结果：序列化后的提示词。 */
export const breakdownContextSchema = z.object({
  /** 工单主键。 */
  ticketId: z.string(),
  /** 线程主键。 */
  threadId: z.string(),
  /** 发给角色的提示词。 */
  prompt: z.string(),
});

/** 拆解工作流输出：任务草稿与说明。 */
export const breakdownWorkflowOutputSchema = breakdownOutputSchema;

/** 拆解工作流依赖：由 runtime 适配器注入，测试可替换。 */
export interface BreakdownWorkflowDeps {
  /** 装载线程、事件与策略上下文。 */
  loadContext(input: { ticketId: string; threadId: string }): Promise<{
    ticketId: string;
    threadId: string;
    prompt: string;
  }>;
  /** 调用拆解角色生成任务草稿。 */
  generate(
    context: z.infer<typeof breakdownContextSchema>,
  ): Promise<BreakdownAgentOutput>;
}

/** 拆解工作流：装载上下文 → 角色出稿 → 校验。 */
export function createBreakdownWorkflow(deps: BreakdownWorkflowDeps) {
  const loadContext = createStep({
    id: 'load-context',
    inputSchema: breakdownWorkflowInputSchema,
    outputSchema: breakdownContextSchema,
    execute: async ({ inputData }) => deps.loadContext(inputData),
  });

  const generateDraft = createStep({
    id: 'generate-draft',
    inputSchema: breakdownContextSchema,
    outputSchema: breakdownOutputSchema,
    execute: async ({ inputData }) => deps.generate(inputData),
  });

  const validateDraft = createStep({
    id: 'validate-draft',
    inputSchema: breakdownOutputSchema,
    outputSchema: breakdownWorkflowOutputSchema,
    execute: async ({ inputData }) => ({
      summary: inputData.summary?.trim() || null,
      tasks: inputData.tasks.slice(0, 20).map((task) => ({
        title: task.title.trim(),
        description: task.description?.trim() || null,
        dependsOn: task.dependsOn ?? null,
        owner: task.owner ?? null,
      })),
    }),
  });

  return createWorkflow({
    id: 'breakdown',
    inputSchema: breakdownWorkflowInputSchema,
    outputSchema: breakdownWorkflowOutputSchema,
  })
    .then(loadContext)
    .then(generateDraft)
    .then(validateDraft)
    .commit();
}
