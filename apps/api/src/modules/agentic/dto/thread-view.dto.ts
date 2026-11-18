import { z } from 'zod';
import { attentionViewSchema } from './ticket-view.dto';

const threadViewSchema = z.object({
  id: z.string(),
  sourceType: z.string(),
  externalKey: z.string(),
  status: z.string(),
  summary: z.string().optional(),
  summaryVersion: z.number().int().nonnegative(),
  lastEventAt: z.string().optional(),
  createdAt: z.string(),
});

const triggerViewSchema = z.object({
  id: z.string(),
  actorId: z.string(),
  text: z.string(),
  addressed: z.string().optional(),
  disposition: z.string(),
  sourceType: z.string(),
  filterReason: z.string().optional(),
  occurredAt: z.string(),
});

const conflictViewSchema = z.object({
  kind: z.string(),
  triggerId: z.string(),
  ticketId: z.string(),
  excerpt: z.string(),
});

/** 线程列表响应。 */
export const threadListViewSchema = z.object({
  items: z.array(threadViewSchema),
});

/** 线程详情响应。 */
export const threadDetailViewSchema = z.object({
  thread: threadViewSchema,
  triggers: z.array(triggerViewSchema),
  tickets: z.array(
    z.object({
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
    }),
  ),
  conflicts: z.array(conflictViewSchema),
});

// 保留 attention schema 类型引用，避免 tree-shaking 误删导出。
export type ThreadAttentionShape = z.infer<typeof attentionViewSchema>;
