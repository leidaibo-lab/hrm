// 导航覆盖更新 schema 是跨端契约，唯一来源在 @cip/shared（契约管线规则 3）；此处只保留域内再导出。
export {
  type UpdateNavigationOverrideDto,
  updateNavigationOverrideSchema,
} from '@cip/shared';

import { z } from 'zod';

export const navigationNodeViewSchema = z.object({
  code: z.string(),
  parentCode: z.string().nullable(),
  path: z.string().nullable(),
  permissionCode: z.string().nullable(),
  state: z.enum(['active', 'deprecated']),
  defaultTitle: z.string(),
  title: z.string().nullable(),
  defaultIcon: z.string().nullable(),
  icon: z.string().nullable(),
  defaultSort: z.number().int(),
  sort: z.number().int().nullable(),
  visible: z.boolean(),
});

export type NavigationNodeViewDto = z.infer<typeof navigationNodeViewSchema>;
