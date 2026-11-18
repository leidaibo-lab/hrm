import type { Decision } from './decision.entity';
import type { Mandate } from './mandate.entity';
import type { Subscription } from './subscription.entity';
import type { Ticket } from './ticket.entity';

/** 接单事务仓储的 DI 令牌。 */
export const ACCEPTANCE_REPOSITORY = Symbol('ACCEPTANCE_REPOSITORY');

/** 接单事务端口：结论、授权与工单必须原子写入。 */
export interface AcceptanceRepository {
  /** 原子写入接单结果。 */
  accept(input: {
    /** 接单结论。 */
    decision: Decision;
    /** 授权。 */
    mandate: Mandate;
    /** 工单。 */
    ticket: Ticket;
    /** 工单对线程的起始订阅。 */
    subscription: Subscription;
  }): Promise<void>;
}
