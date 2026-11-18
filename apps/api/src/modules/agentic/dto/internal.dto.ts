import { z } from 'zod';

/** 内部创建运行请求。 */
export const startRunSchema = z.object({
  /** 工单主键。 */
  ticketId: z.string().min(1),
  /** 执行器运行标识。 */
  executorRunId: z.string().min(1),
});

/** 内部回报请求。 */
export const appendReportSchema = z.object({
  /** 派发主键。 */
  assignmentId: z.string().min(1),
  /** 回报类型。 */
  kind: z.enum(['progress', 'waiting', 'ready', 'blocked', 'failed']),
  /** 回报负载。 */
  payload: z.unknown(),
});

/** 内部产物请求。 */
export const writeArtifactSchema = z.object({
  /** 工单主键。 */
  ticketId: z.string().min(1),
  /** 产物类型。 */
  kind: z.enum(['clarify', 'breakdown', 'analysis', 'report']),
  /** 产物负载。 */
  payload: z.unknown(),
  /** 所属派发主键。 */
  assignmentId: z.string().min(1).nullable().optional(),
});

/** 内部创建运行请求类型。 */
export type StartRunRequest = z.infer<typeof startRunSchema>;
/** 内部回报请求类型。 */
export type AppendReportRequest = z.infer<typeof appendReportSchema>;
/** 内部产物请求类型。 */
export type WriteArtifactRequest = z.infer<typeof writeArtifactSchema>;

/** 清理超时副作用请求。 */
export const reconcileEffectsSchema = z.object({
  limit: z.number().int().min(1).max(500).optional(),
});

/** 清理超时副作用请求类型。 */
export type ReconcileEffectsRequest = z.infer<typeof reconcileEffectsSchema>;
