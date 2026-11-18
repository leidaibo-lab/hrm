import type { Trigger } from './trigger.entity';

/** 事件仓储的 DI 令牌。 */
export const TRIGGER_REPOSITORY = Symbol('TRIGGER_REPOSITORY');

/** 事件仓储端口：幂等由唯一约束兜底。 */
export interface TriggerRepository {
  /** 按幂等键查找；不存在返回 null。 */
  findByDedupeKey(dedupeKey: string): Promise<Trigger | null>;
  /** 创建事件；幂等键冲突返回 false，不覆盖原记录。 */
  create(trigger: Trigger): Promise<boolean>;
  /** 列出线程事件，按发生时间升序。 */
  listByThread(threadId: string, limit?: number): Promise<Trigger[]>;
  /** 按主键批量取事件。 */
  listByIds(ids: string[]): Promise<Trigger[]>;
  /** 只更新处置状态与处置时间。 */
  saveDisposition(trigger: Trigger): Promise<void>;
}
