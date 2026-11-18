import type { Policy } from './policy.entity';
import type { Trigger } from './trigger.entity';

/** 路由判定输入。 */
export interface RouterDecisionInput {
  /** 线程主键。 */
  threadId: string;
  /** 本批事件。 */
  triggers: Trigger[];
  /** 当前策略。 */
  policy: Policy;
}

/** 路由判定结果。 */
export interface RouterDecisionResult {
  /** 是否与职责相关。 */
  relevant: boolean;
  /** 是否值得进入执行。 */
  worthProcessing: boolean;
  /** 判断依据。 */
  reason: string | null;
}

/** 路由判定端口：由 runtime 的 fast 档角色实现，失败时返回 null 降级。 */
export interface RouterDecisionPort {
  /** 判定一批事件是否继续进入研判。 */
  decide(input: RouterDecisionInput): Promise<RouterDecisionResult | null>;
}

/** 路由判定端口的 DI 令牌。 */
export const ROUTER_DECISION_PORT = Symbol('ROUTER_DECISION_PORT');
