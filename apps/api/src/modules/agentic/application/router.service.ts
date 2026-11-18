import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  EVAL_LOCK,
  type EvalLockHandle,
  type EvalLockPort,
} from '../domain/eval-lock.port';
import { readPolicyRules } from '../domain/policy.entity';
import {
  ROUTER_DECISION_PORT,
  type RouterDecisionPort,
} from '../domain/router-decision.port';
import type { Subscription } from '../domain/subscription.entity';
import {
  SUBSCRIPTION_REPOSITORY,
  type SubscriptionRepository,
} from '../domain/subscription.repository';
import type { TicketKind } from '../domain/ticket.entity';
import type { Trigger } from '../domain/trigger.entity';
import {
  TRIGGER_REPOSITORY,
  type TriggerRepository,
} from '../domain/trigger.repository';
import type { AdmissionResult } from './admission.service';
import { AdmissionService } from './admission.service';
import type { EvaluateResult } from './eval.service';
import { EvalService } from './eval.service';

/** 路由输入：一条事件与判定所需的上下文。 */
export interface RouteInput {
  /** 待路由事件。 */
  trigger: Trigger;
  /** 所属线程主键。 */
  threadId: string;
  /** 源实例主键。 */
  sourceInstanceId: string;
  /** 范围行（项目、群或表格）。 */
  scopeRow: string;
  /** 发起人是否在策略名单内；缺省时由 actorId 解析。 */
  actorListed?: boolean;
  /** 事件是否点名机器人。 */
  addressed: boolean;
  /** 源内发起人标识。 */
  actorId: string;
  /** 平台用户标识。 */
  actorUserId?: string | null;
  /** 来源类型。 */
  sourceType: string;
  /** 授权范围建议。 */
  scope: unknown;
  /** 项目或空间标识。 */
  scopeKey?: string | null;
  /** 默认工单类型。 */
  defaultTicketKind?: TicketKind;
  /** 当前时间；缺省为系统时间。 */
  now?: Date;
}

/** 路由结果：直通、过滤或进入研判。 */
export type RouteResult =
  | {
      /** 已订阅，事件直通工单。 */
      route: 'fanout';
      /** 订阅者。 */
      subscribers: Subscription[];
    }
  | {
      /** 未通过准入，事件被过滤。 */
      route: 'filtered';
      /** 准入判定。 */
      admission: AdmissionResult;
    }
  | {
      /** 已研判。 */
      route: 'evaluated';
      /** 准入判定。 */
      admission: AdmissionResult;
      /** 研判结果。 */
      evaluation: EvaluateResult;
    };

/** Eval 锁等待上限（毫秒）。 */
const EVAL_LOCK_WAIT_MS = 60_000;
/** Eval 锁重试间隔（毫秒）。 */
const EVAL_LOCK_RETRY_MS = 100;

/**
 * 路由服务：Fast Path 订阅直通，Slow Path 准入后研判。
 * 只有未订阅的事件才进入模型；直通事件只更新处置状态。
 */
@Injectable()
export class RouterService {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: SubscriptionRepository,
    @Inject(TRIGGER_REPOSITORY)
    private readonly triggers: TriggerRepository,
    private readonly admission: AdmissionService,
    private readonly evaluation: EvalService,
    @Inject(EVAL_LOCK) private readonly evalLock: EvalLockPort,
    @Optional()
    @Inject(ROUTER_DECISION_PORT)
    private readonly routerDecision?: RouterDecisionPort,
  ) {}

  /** 路由一条事件；同一线程串行执行，保证单 Thread 只有一个 Eval。 */
  async route(input: RouteInput): Promise<RouteResult> {
    const handle = await this.acquireEvalLock(input.threadId);
    try {
      return await this.routeInternal(input);
    } finally {
      await handle.release();
    }
  }

  /** 等待并获取线程级 Eval 锁；超时抛错交队列重试。 */
  private async acquireEvalLock(threadId: string): Promise<EvalLockHandle> {
    const deadline = Date.now() + EVAL_LOCK_WAIT_MS;
    for (;;) {
      const handle = await this.evalLock.tryAcquire(threadId);
      if (handle) return handle;
      if (Date.now() >= deadline)
        throw new Error(`同线程研判繁忙，稍后重试：${threadId}`);
      await new Promise((resolve) => setTimeout(resolve, EVAL_LOCK_RETRY_MS));
    }
  }

  /** Router 慢路径：开启后由 fast 档角色判断是否值得执行；失败回退确定性路径。 */
  private async rejectedByRouterAgent(
    input: RouteInput,
    policy: { rules: unknown },
    batch: Trigger[],
    now: Date,
  ): Promise<boolean> {
    if (readPolicyRules(policy.rules).routerAgentEnabled !== true) return false;
    if (!this.routerDecision) return false;
    const decision = await this.routerDecision.decide({
      threadId: input.threadId,
      triggers: batch,
      policy: policy as never,
    });
    if (decision?.worthProcessing !== false) return false;
    for (const trigger of batch) {
      if (!trigger.isPending) continue;
      trigger.markFiltered(
        now,
        `router_agent:${decision.reason ?? 'not_worth_processing'}`,
      );
      await this.triggers.saveDisposition(trigger);
    }
    return true;
  }

  /** 实际路由逻辑。 */
  private async routeInternal(input: RouteInput): Promise<RouteResult> {
    const now = input.now ?? new Date();
    const subscribers = await this.subscriptions.listByThread(input.threadId);

    if (subscribers.length > 0) {
      if (input.trigger.isPending) {
        input.trigger.markFannedOut(now);
        await this.triggers.saveDisposition(input.trigger);
      }
      return { route: 'fanout', subscribers };
    }

    const admission = await this.admission.evaluate({
      sourceInstanceId: input.sourceInstanceId,
      scopeRow: input.scopeRow,
      actorListed: input.actorListed,
      actorId: input.actorId,
      addressed: input.addressed,
    });

    if (!admission.admitted || !admission.policy) {
      if (input.trigger.isPending) {
        input.trigger.markFiltered(now, admission.reason);
        await this.triggers.saveDisposition(input.trigger);
      }
      return { route: 'filtered', admission };
    }

    // I4：同一线程的待处理事件合并进本批，避免逐个 Eval。
    const pending = (
      await this.triggers.listByThread(input.threadId, 50)
    ).filter(
      (trigger) =>
        trigger.isPending &&
        trigger.id !== input.trigger.id &&
        trigger.sourceType === input.sourceType,
    );
    const batch = [input.trigger, ...pending].sort(
      (left, right) => left.occurredAt.getTime() - right.occurredAt.getTime(),
    );
    if (await this.rejectedByRouterAgent(input, admission.policy, batch, now)) {
      return { route: 'filtered', admission };
    }

    const evaluation = await this.evaluation.evaluate({
      threadId: input.threadId,
      triggers: batch,
      policy: admission.policy,
      actorId: input.actorId,
      actorUserId: input.actorUserId,
      sourceType: input.sourceType,
      scope: input.scope,
      scopeKey: input.scopeKey,
      defaultTicketKind: input.defaultTicketKind,
      now,
    });

    return { route: 'evaluated', admission, evaluation };
  }
}
