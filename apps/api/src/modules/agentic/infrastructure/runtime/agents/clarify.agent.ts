import { z } from 'zod';

/** 澄清问题 schema。 */
export const clarifyQuestionSchema = z.object({
  /** 问题文本。 */
  question: z.string().min(1),
  /** 可选答案；无法枚举时为 null。 */
  options: z.array(z.string()).nullable(),
});

/** 澄清输出 schema：摘要、结构化草稿与最多 5 个待确认问题。 */
export const clarifyOutputSchema = z.object({
  /** 摘要。 */
  summary: z.string().min(1),
  /** 结构化草稿。 */
  draft: z.record(z.string(), z.unknown()),
  /** 待确认问题，最多 5 个。 */
  questions: z.array(clarifyQuestionSchema).max(5),
});

/** 澄清输出类型。 */
export type ClarifyAgentOutput = z.infer<typeof clarifyOutputSchema>;

/** 澄清目标：无阻塞性信息缺口且问题不超过 5 个即完成。 */
export const CLARIFY_GOAL = {
  objective:
    '基于事件与策略产出澄清稿：摘要、结构化草稿与最多 5 个待确认问题；信息不足时提问，不臆测。',
  judgePrompt:
    '只有当澄清稿覆盖了事件中的目标、范围与验收线索时才判定完成；否则继续提问。',
  maxRuns: 3,
} as const;

/** 澄清角色：main 档，读文档、查相似需求、产出结构化澄清稿。 */
export const CLARIFY_AGENT = {
  key: 'clarify',
  name: 'Agentic Clarification',
  modelTier: 'main',
  tools: ['read-ticket', 'search-similar', 'read-document'],
  instructions: [
    '你是需求澄清助手。根据事件与策略输出结构化澄清稿。',
    '最多提出 5 个真正影响开工的问题；信息不足时在草稿中标注待补充。',
  ].join('\n'),
} as const;
