import { z } from 'zod';

/** 路由结论 schema：是否相关、是否值得处理、范围与强度建议。 */
export const routerDecisionSchema = z.object({
  /** 是否与职责相关。 */
  relevant: z.boolean(),
  /** 是否值得进入执行。 */
  worthProcessing: z.boolean(),
  /** 授权范围建议；不相关时为 null。 */
  scope: z.record(z.string(), z.unknown()).nullable(),
  /** 依据强度。 */
  strength: z.enum(['explicit', 'inferred']).nullable(),
  /** 判断依据。 */
  reason: z.string().nullable(),
});

/** 路由结论类型。 */
export type RouterDecision = z.infer<typeof routerDecisionSchema>;

/** 路由角色：fast 档，只回答相关性与范围，不做执行。 */
export const ROUTER_AGENT = {
  key: 'router',
  name: 'Agentic Router',
  modelTier: 'fast',
  tools: ['read-ticket', 'search-similar'],
  instructions: [
    '你是研发任务路由器。判断事件是否与研发职责相关、是否值得进入执行。',
    '只输出结构化结论；不确定时把 worthProcessing 置为 false，不要臆测范围。',
  ].join('\n'),
} as const;
