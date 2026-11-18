import { z } from 'zod';

/** Watchdog 发现项 schema：类型、目标与建议动作。 */
export const watchdogFindingSchema = z.object({
  /** 目标工单主键；跨工单发现时为 null。 */
  ticketId: z.string().nullable(),
  /** 发现类型。 */
  kind: z.enum(['stalled', 'overdue', 'looping', 'offtrack']),
  /** 说明。 */
  detail: z.string().min(1),
  /** 建议动作。 */
  action: z.enum(['remind', 'escalate', 'pause']).nullable(),
});

/** Watchdog 输出 schema。 */
export const watchdogOutputSchema = z.object({
  /** 发现列表。 */
  findings: z.array(watchdogFindingSchema).max(20),
});

/** Watchdog 输出类型。 */
export type WatchdogAgentOutput = z.infer<typeof watchdogOutputSchema>;

/** Watchdog 角色：fast 档，判断是否有实质进展并给出建议动作。 */
export const WATCHDOG_AGENT = {
  key: 'watchdog',
  name: 'Agentic Watchdog',
  modelTier: 'fast',
  tools: ['read-ticket'],
  instructions: [
    '你是执行巡检器。判断工单是否停滞、超时、空转或偏离目标。',
    '只输出结构化发现；没有问题时返回空列表，不要为了产出而编造。',
  ].join('\n'),
} as const;
