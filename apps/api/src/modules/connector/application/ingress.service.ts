import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditRecordService } from '../../agentic/application/audit-record.service';
import { IngestionService } from '../../agentic/application/ingestion.service';
import { RouterService } from '../../agentic/application/router.service';
import { RoutingRolloutService } from '../../agentic/application/routing-rollout.service';
import {
  INGRESS_RATE_LIMIT,
  type IngressRateLimitPort,
} from '../domain/ingress-rate-limit.port';
import {
  ROUTING_QUEUE,
  type RoutingQueuePort,
} from '../domain/routing-queue.port';
import {
  SOURCE_INSTANCE_REPOSITORY,
  type SourceInstanceRepository,
} from '../domain/source-instance.repository';
import { SourceAuthorizationService } from './source-authorization.service';
import { SourceHealthService } from './source-health.service';
import {
  SOURCE_REGISTRY,
  type SourceRegistry,
} from './source-registry.service';

/** 灰度判定结果（结构由 agentic 的 RoutingRolloutService 返回）。 */
interface RolloutDecision {
  /** 是否走异步路径。 */
  enabled: boolean;
  /** 是否配置了灰度规则。 */
  configured: boolean;
  /** 未命中原因。 */
  reasons: string[];
}

/** 接入输入：实例 + 原始事件。 */
export interface IngressInput {
  /** 来源实例主键。 */
  instanceId: string;
  /** 原始事件。 */
  raw: unknown;
  /** 当前时间；缺省为系统时间。 */
  now?: Date;
  /** 是否把路由研判交由 worker 异步执行（回调入口必须为 true）。 */
  deferRouting?: boolean;
}

/** 接入失败原因。 */
export type IngressRejection =
  | 'instance_not_found'
  | 'instance_disabled'
  | 'invalid_config'
  | 'untranslatable'
  | 'out_of_scope'
  | 'unauthorized'
  | 'rate_limited';

/** 接入结果。 */
export type IngressResult =
  | {
      /** 已接收。 */
      accepted: true;
      /** 事件主键。 */
      triggerId: string;
      /** 是否本次新建。 */
      created: boolean;
      /** 路由结果：queued（已入队）/ fanout / filtered / evaluated。 */
      routed: 'queued' | 'fanout' | 'filtered' | 'evaluated';
    }
  | {
      /** 未接收。 */
      accepted: false;
      /** 原因。 */
      reason: IngressRejection;
    };

/** 接入用例：实例配置 → 适配器翻译 → 范围判定 → agentic 事件接入。 */
@Injectable()
export class IngressService {
  private readonly logger = new Logger(IngressService.name);

  constructor(
    @Inject(SOURCE_INSTANCE_REPOSITORY)
    private readonly instances: SourceInstanceRepository,
    @Inject(SOURCE_REGISTRY) private readonly registry: SourceRegistry,
    private readonly ingestion: IngestionService,
    private readonly router: RouterService,
    private readonly health: SourceHealthService,
    @Inject(ROUTING_QUEUE) private readonly routing: RoutingQueuePort,
    @Inject(INGRESS_RATE_LIMIT)
    private readonly rateLimit: IngressRateLimitPort,
    private readonly rollout: RoutingRolloutService,
    private readonly authorizations: SourceAuthorizationService,
    private readonly audit: AuditRecordService,
  ) {}

  /** 接收一条原始事件；未通过范围或配置时返回拒绝原因。 */
  async accept(input: IngressInput): Promise<IngressResult> {
    const instance = await this.instances.findById(input.instanceId);
    if (!instance) return { accepted: false, reason: 'instance_not_found' };
    if (!instance.isEnabled)
      return { accepted: false, reason: 'instance_disabled' };
    if (!(await this.rateLimit.tryAcquire(instance.id)))
      return { accepted: false, reason: 'rate_limited' };

    const adapter = this.registry.get(instance.sourceType);
    let config: unknown;
    try {
      config = adapter.validateConfig(instance.config);
    } catch {
      await this.health.mark(
        instance.id,
        'ingress',
        'error',
        '配置无效',
        input.now,
      );
      return { accepted: false, reason: 'invalid_config' };
    }

    const envelope = adapter.translate(input.raw, config);
    if (!envelope) return { accepted: false, reason: 'untranslatable' };

    const scope = adapter.scope(envelope, config);
    if (!scope.listened) return { accepted: false, reason: 'out_of_scope' };

    const scopeKey = scope.row ?? envelope.scopeKey ?? instance.name;
    if (
      !(await this.authorizations.isAuthorized(
        instance.id,
        scopeKey,
        input.now,
      ))
    )
      return { accepted: false, reason: 'unauthorized' };

    const result = await this.ingestion.ingest({
      sourceType: envelope.sourceType,
      dedupeKey: envelope.dedupeKey,
      instanceId: instance.id,
      threadKey: envelope.threadKey,
      scopeKey: envelope.scopeKey,
      actorId: envelope.actorId,
      text: envelope.text,
      payload: envelope.payload,
      occurredAt: envelope.occurredAt,
      addressed: envelope.addressed,
      now: input.now,
    });

    if (!result.created) {
      return {
        accepted: true,
        triggerId: result.trigger.id,
        created: false,
        routed: 'filtered',
      };
    }

    const rollout =
      input.deferRouting === true
        ? await this.rollout.decide({
            sourceType: envelope.sourceType,
            scopeKey: envelope.scopeKey,
            role: 'assess',
          })
        : null;
    if (rollout?.configured)
      await this.recordRollout(result.trigger.id, envelope, rollout, input.now);
    const deferRouting = rollout?.enabled === true;
    if (deferRouting) {
      await this.routing.enqueue({
        triggerId: result.trigger.id,
        sourceInstanceId: instance.id,
        scopeRow: envelope.scopeKey ?? instance.name,
        addressed:
          envelope.addressed === 'mention' || envelope.addressed === 'direct',
        actorId: envelope.actorId,
        sourceType: envelope.sourceType,
        scopeKey: envelope.scopeKey,
        at: (input.now ?? new Date()).toISOString(),
      });
      await this.health.mark(instance.id, 'ingress', 'ready', null, input.now);
      return {
        accepted: true,
        triggerId: result.trigger.id,
        created: true,
        routed: 'queued',
      };
    }

    const route = await this.router.route({
      trigger: result.trigger,
      threadId: result.trigger.threadId,
      sourceInstanceId: instance.id,
      scopeRow: envelope.scopeKey ?? instance.name,
      addressed:
        envelope.addressed === 'mention' || envelope.addressed === 'direct',
      actorId: envelope.actorId,
      sourceType: envelope.sourceType,
      scope: {},
      scopeKey: envelope.scopeKey,
      now: input.now,
    });

    await this.health.mark(instance.id, 'ingress', 'ready', null, input.now);
    return {
      accepted: true,
      triggerId: result.trigger.id,
      created: true,
      routed: route.route,
    };
  }
  /** 灰度判定审计：写失败只告警，不影响接入。 */
  private async recordRollout(
    triggerId: string,
    envelope: { sourceType: string; scopeKey: string | null },
    decision: RolloutDecision,
    now: Date | undefined,
  ): Promise<void> {
    try {
      await this.audit.record({
        traceId: `trigger-${triggerId}`,
        actorId: null,
        action: 'routing.rollout',
        method: 'WORKER',
        path: 'routing',
        statusCode: 200,
        detail: {
          sourceType: envelope.sourceType,
          scopeKey: envelope.scopeKey,
          role: 'assess',
          enabled: decision.enabled,
          reasons: decision.reasons,
        },
        now,
      });
    } catch (error) {
      this.logger.warn(
        `灰度审计写入失败：${
          error instanceof Error ? error.message : '未知错误'
        }`,
      );
    }
  }
}
