import type { OutboundMessage } from './outbound-message.entity';

/** 出站消息仓储的 DI 令牌。 */
export const OUTBOUND_MESSAGE_REPOSITORY = Symbol(
  'OUTBOUND_MESSAGE_REPOSITORY',
);

/** 出站消息仓储端口。 */
export interface OutboundMessageRepository {
  /** 按主键查找；不存在返回 null。 */
  findById(id: string): Promise<OutboundMessage | null>;
  /** 按幂等键查找；不存在返回 null。 */
  findByIdempotencyKey(idempotencyKey: string): Promise<OutboundMessage | null>;
  /** 取到期待发消息，按创建时间升序。 */
  listDue(at: Date, limit: number): Promise<OutboundMessage[]>;
  /** 保存消息（新建或更新状态）。 */
  save(message: OutboundMessage): Promise<void>;
}
