import { Inject, Injectable } from '@nestjs/common';
import {
  TRIGGER_REPOSITORY,
  type TriggerRepository,
} from '../domain/trigger.repository';
import type { RouteResult } from './router.service';
import { RouterService } from './router.service';

/** 事件路由输入：worker 按事件主键异步研判。 */
export interface RouteTriggerInput {
  /** 事件主键。 */
  triggerId: string;
  /** 源实例主键。 */
  sourceInstanceId: string;
  /** 范围行（项目、群或表格）。 */
  scopeRow: string;
  /** 是否点名机器人。 */
  addressed: boolean;
  /** 源内发起人标识。 */
  actorId: string;
  /** 平台用户标识。 */
  actorUserId?: string | null;
  /** 来源类型。 */
  sourceType: string;
  /** 项目或空间标识。 */
  scopeKey?: string | null;
  /** 入站时间。 */
  now?: Date;
}

/**
 * 路由入口：供 connector worker 在进程内调用。
 * 已处置事件直接跳过，保证队列重试幂等。
 */
@Injectable()
export class RoutingService {
  constructor(
    @Inject(TRIGGER_REPOSITORY) private readonly triggers: TriggerRepository,
    private readonly router: RouterService,
  ) {}

  /** 按事件主键路由；事件不存在或已处置时返回 null。 */
  async routeTrigger(input: RouteTriggerInput): Promise<RouteResult | null> {
    const [trigger] = await this.triggers.listByIds([input.triggerId]);
    if (!trigger?.isPending) return null;
    return this.router.route({
      trigger,
      threadId: trigger.threadId,
      sourceInstanceId: input.sourceInstanceId,
      scopeRow: input.scopeRow,
      addressed: input.addressed,
      actorId: input.actorId,
      actorUserId: input.actorUserId ?? null,
      sourceType: input.sourceType,
      scope: {},
      scopeKey: input.scopeKey ?? null,
      now: input.now,
    });
  }
}
