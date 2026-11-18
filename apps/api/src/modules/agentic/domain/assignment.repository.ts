import type { Assignment } from './assignment.entity';

/** 派发仓储的 DI 令牌。 */
export const ASSIGNMENT_REPOSITORY = Symbol('ASSIGNMENT_REPOSITORY');

/** 派发仓储端口。 */
export interface AssignmentRepository {
  /** 按主键查找；不存在返回 null。 */
  findById(id: string): Promise<Assignment | null>;
  /** 列出工单的派发，按创建时间升序。 */
  listByTicket(ticketId: string): Promise<Assignment[]>;
  /** 工单当前未结束的派发；没有返回 null。 */
  findActiveByTicket(ticketId: string): Promise<Assignment | null>;
  /** 保存派发（新建或更新状态）。 */
  save(assignment: Assignment): Promise<void>;
}
