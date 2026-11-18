import { z } from 'zod';

/** 线程列表查询。 */
export const listThreadsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/** 线程列表查询类型。 */
export type ListThreadsQuery = z.infer<typeof listThreadsQuerySchema>;
