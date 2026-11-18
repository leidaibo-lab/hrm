/** 支持的来源类型：与数据库枚举 `agentic_source_type` 一致。 */
export const SourceType = {
  Lark: 'lark',
  Zentao: 'zentao',
  Gitlab: 'gitlab',
} as const;

/** 来源类型联合。 */
export type SourceType = (typeof SourceType)[keyof typeof SourceType];

/** 是否点名机器人：与数据库枚举 `agentic_addressed` 一致。 */
export const Addressed = {
  Mention: 'mention',
  Direct: 'direct',
} as const;

/** 点名方式联合。 */
export type Addressed = (typeof Addressed)[keyof typeof Addressed];
