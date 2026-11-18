import type { Effect } from './effect.entity';

/** 副作用仓储的 DI 令牌。 */
export const EFFECT_REPOSITORY = Symbol('EFFECT_REPOSITORY');

/** 副作用仓储端口：按幂等键唯一。 */
export interface EffectRepository {
  /** 按幂等键查找；不存在返回 null。 */
  findByIdempotencyKey(idempotencyKey: string): Promise<Effect | null>;
  /** 创建副作用；幂等键冲突返回 false。 */
  create(effect: Effect): Promise<boolean>;
  /** 保存状态与结果。 */
  save(effect: Effect): Promise<void>;
  /** 列出早于阈值且仍 pending 的副作用。 */
  listPendingBefore(cutoff: Date, limit: number): Promise<Effect[]>;
}
