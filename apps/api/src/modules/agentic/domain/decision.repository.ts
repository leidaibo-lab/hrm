import type { Decision } from './decision.entity';

/** 研判结论仓储的 DI 令牌。 */
export const DECISION_REPOSITORY = Symbol('DECISION_REPOSITORY');

/** 研判结论仓储端口：结论与事件关联在同一事务内写入。 */
export interface DecisionRepository {
  /** 按主键查找；不存在返回 null。 */
  findById(id: string): Promise<Decision | null>;
  /** 列出线程结论，按时间升序。 */
  listByThread(threadId: string): Promise<Decision[]>;
  /** 创建结论及其事件关联。 */
  create(decision: Decision): Promise<void>;
}
