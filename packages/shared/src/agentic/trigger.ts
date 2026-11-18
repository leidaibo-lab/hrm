import type { Addressed, SourceType } from './enums';

/** 归一化后的事件信封：跨模块只传它。 */
export interface TriggerEnvelope {
  /** 来源内稳定幂等键。 */
  dedupeKey: string;
  /** 来源类型。 */
  sourceType: SourceType;
  /** 来源内稳定线程键。 */
  threadKey: string;
  /** 项目或空间标识。 */
  scopeKey: string | null;
  /** 源内操作者标识。 */
  actorId: string;
  /** 事件文本。 */
  text: string;
  /** 原始负载。 */
  payload: unknown;
  /** 事件发生时间。 */
  occurredAt: Date;
  /** 是否点名机器人。 */
  addressed: Addressed | null;
}
