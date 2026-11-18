import type { Ticket, TicketStatus } from './ticket.entity';

/** 工单仓储的 DI 令牌。 */
export const TICKET_REPOSITORY = Symbol('TICKET_REPOSITORY');

/** 工单仓储端口：状态迁移由聚合保证，仓储只负责取存。 */
export interface TicketRepository {
  /** 按主键查找；不存在返回 null。 */
  findById(id: string): Promise<Ticket | null>;
  /** 按授权查找；一对一关系，不存在返回 null。 */
  findByMandateId(mandateId: string): Promise<Ticket | null>;
  /** 按条件列出工单，按开启时间倒序。 */
  list(filter: {
    /** 状态过滤。 */
    status?: TicketStatus;
    /** 项目或空间过滤。 */
    scopeKey?: string;
    /** 允许访问的项目/空间集合；未设置表示不限制。 */
    scopeKeys?: string[];
    /** 返回上限。 */
    limit?: number;
  }): Promise<Ticket[]>;
  /** 列出线程上的工单。 */
  listByThread(threadId: string): Promise<Ticket[]>;
  /** 保存工单（新建或更新可变状态）。 */
  save(ticket: Ticket): Promise<void>;
}
