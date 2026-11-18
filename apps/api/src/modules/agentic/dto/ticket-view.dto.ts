import { z } from 'zod';

export const ticketViewSchema = z.object({
  id: z.string(),
  mandateId: z.string(),
  threadId: z.string(),
  scopeKey: z.string().optional(),
  kind: z.enum(['requirement', 'bug', 'release']),
  status: z.enum(['open', 'ended']),
  openedAt: z.string(),
  endedAt: z.string().optional(),
  endReason: z.string().optional(),
  assignee: z.string().optional(),
  deadline: z.string().optional(),
  overdue: z.boolean(),
  waitingCount: z.number().int().nonnegative(),
});

export const attentionViewSchema = z.object({
  id: z.string(),
  ticketId: z.string(),
  kind: z.string(),
  question: z.string(),
  status: z.string(),
  assignee: z.string(),
  deadline: z.string(),
  decidedBy: z.string().optional(),
  decidedAt: z.string().optional(),
  answer: z.unknown(),
});

const mandateViewSchema = z.object({
  id: z.string(),
  policyId: z.string(),
  policyVersion: z.number().int().positive(),
  strength: z.string(),
  scope: z.unknown(),
  actorId: z.string(),
  createdAt: z.string(),
});

const artifactViewSchema = z.object({
  id: z.string(),
  kind: z.string(),
  version: z.number().int().positive(),
  status: z.string(),
  payload: z.unknown(),
  createdAt: z.string(),
});

const assignmentViewSchema = z.object({
  id: z.string(),
  status: z.string(),
  attempt: z.number().int().nonnegative(),
  executorRunId: z.string().optional(),
  startedAt: z.string().optional(),
  endedAt: z.string().optional(),
  error: z.string().optional(),
});

/** 工单列表响应。 */
export const ticketListResponseSchema = z.object({
  items: z.array(ticketViewSchema),
});

/** 工单详情响应。 */
export const ticketDetailResponseSchema = z.object({
  ticket: ticketViewSchema,
  mandate: mandateViewSchema.optional(),
  artifacts: z.array(artifactViewSchema),
  attentions: z.array(attentionViewSchema),
  assignments: z.array(assignmentViewSchema),
});

/** 工单轨迹响应。 */
export const ticketTimelineSchema = z.object({
  ticketId: z.string(),
  threadId: z.string(),
  events: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      at: z.string(),
      summary: z.string(),
      detail: z.unknown().optional(),
    }),
  ),
  snapshot: z.object({
    status: z.string(),
    endReason: z.string().optional(),
    artifacts: z.array(
      z.object({
        kind: z.string(),
        version: z.number().int().positive(),
        status: z.string(),
        payload: z.unknown(),
      }),
    ),
    attentions: z.array(
      z.object({
        id: z.string(),
        question: z.string(),
        status: z.string(),
        decidedAt: z.string().optional(),
      }),
    ),
  }),
});
