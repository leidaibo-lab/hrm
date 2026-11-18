import { z } from 'zod';

/** 运行 Agent 回归请求。 */
export const runAgentRegressionSchema = z.object({
  threshold: z.number().gt(0).max(1).optional(),
});

/** 运行 Agent 回归请求类型。 */
export type RunAgentRegressionRequest = z.infer<
  typeof runAgentRegressionSchema
>;
