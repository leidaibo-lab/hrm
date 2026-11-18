import { z } from 'zod';

/** 导航覆盖更新：全字段显式提交，null 恢复目录默认（全量替换语义）。 */
export const updateNavigationOverrideSchema = z.object({
  title: z.string().min(1).max(64).nullable(),
  icon: z.string().min(1).max(64).nullable(),
  sort: z.number().int().min(0).max(9999).nullable(),
  visible: z.boolean(),
});

export type UpdateNavigationOverrideDto = z.infer<
  typeof updateNavigationOverrideSchema
>;
