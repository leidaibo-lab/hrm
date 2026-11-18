import { z } from 'zod';

/** 审计记录视图。 */
export const auditViewSchema = z.object({
  id: z.string(),
  traceId: z.string(),
  actorId: z.string().optional(),
  action: z.string(),
  method: z.string(),
  path: z.string(),
  statusCode: z.number().int(),
  detail: z.unknown(),
  createdAt: z.string(),
});

/** 审计列表响应。 */
export const auditListResponseSchema = z.object({
  items: z.array(auditViewSchema),
});

const traceToolCallSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  input: z.unknown().optional(),
  output: z.unknown().optional(),
});

const traceRunSchema = z.object({
  id: z.string(),
  ticketId: z.string().optional(),
  action: z.string(),
  path: z.string(),
  statusCode: z.number().int(),
  actorId: z.string().optional(),
  createdAt: z.string(),
  role: z.string().optional(),
  speculative: z.boolean().optional(),
  result: z.string().optional(),
  error: z.string().optional(),
  durationMs: z.number().nonnegative().optional(),
  tokens: z.number().nonnegative().optional(),
  steps: z.array(z.string()).optional(),
  toolCalls: z.array(traceToolCallSchema).optional(),
  mandateId: z.string().optional(),
  policyVersion: z.number().int().positive().optional(),
  triggerIds: z.array(z.string()).optional(),
  artifactId: z.string().optional(),
  artifactKind: z.string().optional(),
  artifactVersion: z.number().int().positive().optional(),
});

/** trace 回放响应。 */
export const traceReplaySchema = z.object({
  traceId: z.string(),
  runs: z.array(traceRunSchema),
  steps: z.array(z.string()),
  artifacts: z.array(
    z.object({
      artifactId: z.string(),
      ticketId: z.string().optional(),
      kind: z.string().optional(),
      version: z.number().int().positive().optional(),
    }),
  ),
  basis: z.object({
    mandateId: z.string().optional(),
    policyVersion: z.number().int().positive().optional(),
    triggerIds: z.array(z.string()).optional(),
  }),
  items: z.array(auditViewSchema),
});
