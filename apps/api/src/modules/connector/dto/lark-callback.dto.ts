import { z } from 'zod';

/** 飞书事件体：加密与否在入口判定。 */
export const larkEventSchema = z
  .object({
    type: z.string().optional(),
    challenge: z.string().optional(),
    token: z.string().optional(),
    header: z
      .object({
        token: z.string().optional(),
        event_type: z.string().optional(),
      })
      .passthrough()
      .optional(),
    event: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

/** 飞书事件体类型。 */
export type LarkEvent = z.infer<typeof larkEventSchema>;

/** 飞书回调：加密信封或明文事件。 */
export const larkCallbackSchema = z.union([
  z.object({ encrypt: z.string().min(1) }),
  larkEventSchema,
]);

/** 飞书回调类型。 */
export type LarkCallback = z.infer<typeof larkCallbackSchema>;
