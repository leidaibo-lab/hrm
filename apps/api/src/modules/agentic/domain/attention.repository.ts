import type { Attention } from './attention.entity';

/** 关注仓储的 DI 令牌。 */
export const ATTENTION_REPOSITORY = Symbol('ATTENTION_REPOSITORY');

/** 关注仓储端口。 */
export interface AttentionRepository {
  /** 按主键查找；不存在返回 null。 */
  findById(id: string): Promise<Attention | null>;
  /** 列出工单的待答关注。 */
  listOpenByTicket(ticketId: string): Promise<Attention[]>;
  /** 列出全部待答关注，按创建时间升序。 */
  listOpen(limit: number): Promise<Attention[]>;
  /** 列出工单的全部关注（含已回答/已过期）。 */
  listByTicket(ticketId: string): Promise<Attention[]>;
  /** 保存关注（新建或更新状态）。 */
  save(attention: Attention): Promise<void>;
}
