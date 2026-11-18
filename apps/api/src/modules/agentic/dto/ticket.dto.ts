import { z } from 'zod';

/** 工单列表查询。 */
export const listTicketsQuerySchema = z.object({
  status: z.enum(['open', 'ended']).optional(),
  scopeKey: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/** 工单列表查询类型。 */
export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>;

/** 结束工单请求。 */
export const endTicketSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

/** 结束工单请求类型。 */
export type EndTicketRequest = z.infer<typeof endTicketSchema>;

/** 回答关注请求：决定类型 + 答案。 */
export const answerAttentionSchema = z
  .object({
    answer: z.unknown(),
    decision: z.enum(['confirm', 'modify', 'reject']).default('confirm'),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((value) => value.answer !== undefined, {
    message: '答案不能为空',
  });

/** 回答关注请求类型。 */
export type AnswerAttentionRequest = z.infer<typeof answerAttentionSchema>;
