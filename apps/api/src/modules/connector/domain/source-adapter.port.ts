import type { SourceType, TriggerEnvelope } from '@cip/shared';

export type { Addressed, TriggerEnvelope } from '@cip/shared';
export { SourceType } from '@cip/shared';

/** 配置校验器：只暴露 parse，避免 domain 依赖具体校验库。 */
export interface ConfigSchema<C> {
  /** 校验并返回配置；不合法直接抛出。 */
  parse(raw: unknown): C;
}

/** 范围判定结果。 */
export interface ScopeResult {
  /** 是否接收。 */
  listened: boolean;
  /** 是否接收未点名消息；未实现时缺省。 */
  observed?: boolean;
  /** 命中的范围行。 */
  row: string | null;
  /** 未接收原因。 */
  reason?: string;
}

/** 出站地址。 */
export interface ReplyTarget {
  /** 地址键，用于去重与定位。 */
  addressKey: string;
  /** 地址负载。 */
  address: Record<string, unknown>;
}

/**
 * 来源适配器抽象类：每个外部系统实现一个子类，由注册表按类型索引。
 * 只做翻译、范围判定与出站定位，不承载业务语义。
 */
export abstract class SourceAdapter<C> {
  /** 来源类型。 */
  abstract readonly type: SourceType;
  /** 配置 schema。 */
  abstract readonly schema: ConfigSchema<C>;

  /** 原始事件 → 归一化信封；无效或自身消息返回 undefined。 */
  abstract translate(raw: unknown, config: C): TriggerEnvelope | undefined;
  /** 判定事件是否在接收范围内。 */
  abstract scope(envelope: TriggerEnvelope, config: C): ScopeResult;
  /** 事件对应的出站地址。 */
  abstract replyTarget(envelope: TriggerEnvelope): ReplyTarget;

  /** 校验配置；不合法直接抛出。 */
  validateConfig(raw: unknown): C {
    return this.schema.parse(raw);
  }
}
