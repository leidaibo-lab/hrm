import { z } from 'zod';

/** 拆解任务项 schema：标题、说明、依赖序号与建议负责人。 */
export const breakdownTaskDraftSchema = z.object({
  /** 任务标题。 */
  title: z.string().min(1),
  /** 任务说明；信息不足时为 null。 */
  description: z.string().nullable(),
  /** 依赖的任务序号（从 0 开始）；无依赖为 null。 */
  dependsOn: z.array(z.number().int().nonnegative()).nullable(),
  /** 建议负责人；无法判断时为 null。 */
  owner: z.string().nullable(),
});

/** 拆解输出 schema：任务草稿与拆解说明。 */
export const breakdownOutputSchema = z.object({
  /** 任务列表。 */
  tasks: z.array(breakdownTaskDraftSchema).min(1).max(20),
  /** 拆解说明。 */
  summary: z.string().nullable(),
});

/** 拆解输出类型。 */
export type BreakdownAgentOutput = z.infer<typeof breakdownOutputSchema>;

/** 拆解目标：任务树覆盖验收标准且粒度、依赖合规即完成。 */
export const BREAKDOWN_GOAL = {
  objective:
    '把已确认需求拆成可执行任务：覆盖验收标准、标注依赖与建议负责人；信息不足时在说明中标注。',
  judgePrompt:
    '只有当任务树覆盖验收标准且粒度、依赖合规时才判定完成；否则继续调整。',
  maxRuns: 6,
} as const;

/** 拆解角色：main 档，查相似任务、依赖与负责人后产出任务草稿。 */
export const BREAKDOWN_AGENT = {
  key: 'breakdown',
  name: 'Agentic Breakdown',
  modelTier: 'main',
  tools: ['read-ticket', 'search-similar'],
  instructions: [
    '你是任务拆解助手。把已确认的需求拆成可执行任务，标注依赖与建议负责人。',
    '任务粒度以一天内可完成为宜；信息不足时在说明中标注，不要编造负责人。',
  ].join('\n'),
} as const;
