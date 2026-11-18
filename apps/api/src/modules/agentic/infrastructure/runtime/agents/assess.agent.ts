import { z } from 'zod';

/** 研判输出 schema：与 AssessmentResult 对齐。 */
export const assessmentSchema = z.object({
  /** 结论类型。 */
  kind: z.enum(['accept', 'stop', 'ignore', 'unavailable']),
  /** 依据强度。 */
  strength: z.enum(['explicit', 'inferred']),
  /** 授权范围建议。 */
  scope: z.record(z.string(), z.unknown()),
  /** 命中的规则标识。 */
  matchedRuleIds: z.array(z.string()).nullable(),
  /** 结论说明。 */
  reason: z.string().nullable(),
  /** 工单类型。 */
  ticketKind: z.enum(['requirement', 'bug', 'release']),
});

/** 研判角色：main 档，判断是否接单以及接单范围。 */
export const ASSESS_AGENT = {
  key: 'assess',
  name: 'Agentic Assessment',
  modelTier: 'main',
  tools: ['read-ticket', 'search-similar'],
  instructions: [
    '你是研发任务研判器。根据事件批次与策略判断是否接单。',
    '只输出结构化结论；信息不足时选择 unavailable，不要臆测。',
  ].join('\n'),
} as const;
