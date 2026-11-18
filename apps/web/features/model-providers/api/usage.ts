import { usageControllerQuery } from '@/lib/api-client';

/** usage 表格行：POST /ai/usages/query 响应的展示形态（生成 SDK 推导）。 */
export type UsageRow = NonNullable<
  Awaited<ReturnType<typeof usageControllerQuery>>['data']
>['items'][number];

/** 用量汇总读模型（response.meta，与 items 同筛选条件跨页统计）。 */
export type UsageSummary = NonNullable<
  Awaited<ReturnType<typeof usageControllerQuery>>['data']
>['meta'];

/**
 * TableView query 适配：汇总经响应 meta 供给 renderMeta（同一 query cache），
 * 不再复制到 React state。
 */
export { usageControllerQuery as queryUsageReport };
