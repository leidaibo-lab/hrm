import { Inject, Injectable, Logger } from '@nestjs/common';
import { AttentionService } from '../../agentic/application/attention.service';
import { AuditRecordService } from '../../agentic/application/audit-record.service';
import { EffectService } from '../../agentic/application/effect.service';
import { MetricsQueryService } from '../../agentic/application/metrics-query.service';
import { PolicyService } from '../../agentic/application/policy.service';
import {
  OUTBOUND_FAILURE_COUNTER,
  type OutboundFailureCounterPort,
} from '../domain/outbound-failure-counter.port';
import {
  OUTBOUND_MESSAGE_REPOSITORY,
  type OutboundMessageRepository,
} from '../domain/outbound-message.repository';
import {
  OUTBOUND_RATE_LIMIT,
  type OutboundRateLimitPort,
} from '../domain/outbound-rate-limit.port';
import { PermanentOutboundError } from '../domain/outbound-transport.port';
import {
  SOURCE_INSTANCE_REPOSITORY,
  type SourceInstanceRepository,
} from '../domain/source-instance.repository';
import { OutboundService } from './outbound.service';
import {
  OUTBOUND_TRANSPORT_REGISTRY,
  type OutboundTransportRegistry,
} from './outbound-transport.service';
import { SourceHealthService } from './source-health.service';

/** 连续失败暂停来源的阈值（operations.md §4.7）。 */
const OUTBOUND_FAILURE_THRESHOLD = 10;

/** 一次派发的结果计数。 */
export interface DispatchResult {
  /** 发送成功数。 */
  sent: number;
  /** 可重试失败数。 */
  failed: number;
  /** 永久失败数。 */
  gone: number;
}

/** 出站派发：取到期消息，按实例类型选传输并推进状态。 */
@Injectable()
export class OutboundDispatcherService {
  private readonly logger = new Logger(OutboundDispatcherService.name);

  constructor(
    @Inject(OUTBOUND_MESSAGE_REPOSITORY)
    private readonly messages: OutboundMessageRepository,
    @Inject(SOURCE_INSTANCE_REPOSITORY)
    private readonly instances: SourceInstanceRepository,
    @Inject(OUTBOUND_TRANSPORT_REGISTRY)
    private readonly transports: OutboundTransportRegistry,
    private readonly outbound: OutboundService,
    private readonly health: SourceHealthService,
    @Inject(OUTBOUND_RATE_LIMIT)
    private readonly rateLimit: OutboundRateLimitPort,
    @Inject(OUTBOUND_FAILURE_COUNTER)
    private readonly failures: OutboundFailureCounterPort,
    private readonly metrics: MetricsQueryService,
    private readonly audit: AuditRecordService,
    private readonly attentions: AttentionService,
    private readonly effects: EffectService,
    private readonly policies: PolicyService,
  ) {}

  /** 派发一批到期消息；单条失败不影响后续。 */
  async dispatchDue(
    limit = 20,
    now: Date = new Date(),
  ): Promise<DispatchResult> {
    const due = await this.messages.listDue(now, limit);
    const result: DispatchResult = { sent: 0, failed: 0, gone: 0 };

    for (const message of due) {
      const instance = await this.instances.findById(message.instanceId);
      if (!instance?.isEnabled) {
        await this.outbound.recordGone(message.id, '来源实例不可用', now);
        await this.auditGone(
          message.id,
          instance?.id ?? message.instanceId,
          '来源实例不可用',
          now,
        );
        await this.raiseGoneAttention(message, '来源实例不可用', now);
        await this.raiseGoneAlert(message, '来源实例不可用', now);
        result.gone += 1;
        this.metrics.increment('agentic_outbound_total', { result: 'gone' });
        continue;
      }

      try {
        // 超出该来源每秒配额：本轮停止派发，消息保持 pending 由下一轮重试。
        if (!(await this.rateLimit.tryAcquire(instance.id))) break;
        const transport = this.transports.get(instance.sourceType);
        // effects 记外部写幂等；outbox 记投递状态，避免崩溃后重复发送。
        await this.effects.execute({
          idempotencyKey: message.idempotencyKey,
          kind: 'send_card',
          target: message.instanceId,
          now,
          run: async () => {
            await transport.send({
              address: message.address,
              payload: message.payload,
            });
            return { sent: true };
          },
        });
        await this.outbound.recordSent(message.id, now);
        await this.failures.reset(instance.id);
        await this.health.mark(instance.id, 'outbound', 'ready', null, now);
        result.sent += 1;
        this.metrics.increment('agentic_outbound_total', { result: 'sent' });
      } catch (error) {
        const reason = error instanceof Error ? error.message : '未知错误';
        await this.health.mark(instance.id, 'outbound', 'error', reason, now);
        const consecutive = await this.failures.increment(instance.id);
        if (consecutive >= OUTBOUND_FAILURE_THRESHOLD) {
          // 运营约定：连续失败达到阈值暂停来源，避免持续失败拖垮出站。
          instance.disable(now);
          await this.instances.save(instance);
          await this.health.mark(
            instance.id,
            'outbound',
            'error',
            `连续失败 ${consecutive} 次，已暂停来源`,
            now,
          );
        }
        if (
          error instanceof PermanentOutboundError ||
          (error instanceof Error && error.name === 'EffectUncertainError')
        ) {
          await this.outbound.recordGone(message.id, reason, now);
          await this.auditGone(message.id, instance.id, reason, now);
          await this.raiseGoneAttention(message, reason, now);
          await this.raiseGoneAlert(message, reason, now);
          result.gone += 1;
          this.metrics.increment('agentic_outbound_total', { result: 'gone' });
        } else {
          await this.outbound.recordFailure(message.id, reason, now);
          result.failed += 1;
          this.metrics.increment('agentic_outbound_total', {
            result: 'failed',
          });
        }
      }
    }

    return result;
  }

  /** 出站永久失败时给工单负责人建关注（外部渠道不可用的降级通知）。 */
  private async raiseGoneAttention(
    message: { payload: unknown },
    reason: string,
    now: Date,
  ): Promise<void> {
    const payload =
      message.payload && typeof message.payload === 'object'
        ? (message.payload as { ticketId?: unknown })
        : {};
    if (typeof payload.ticketId !== 'string') return;
    try {
      await this.attentions.raiseOutboundFailure(payload.ticketId, reason, now);
    } catch (error) {
      this.logger.warn(
        `出站失败关注创建失败：${
          error instanceof Error ? error.message : '未知错误'
        }`,
      );
    }
  }

  /**
   * 永久失败外部告警：按策略 chat_id 入队一条告警消息。
   * 告警消息自身永久失败时不再递归告警；同一失败消息只入队一次。
   */
  private async raiseGoneAlert(
    message: { id: string; instanceId: string; payload: unknown },
    reason: string,
    now: Date,
  ): Promise<void> {
    const payload =
      message.payload && typeof message.payload === 'object'
        ? (message.payload as { kind?: unknown })
        : {};
    if (payload.kind === 'alert') return;
    try {
      const chatId = await this.policies.goneNotifyChatId();
      if (!chatId) return;
      await this.outbound.enqueue({
        instanceId: message.instanceId,
        address: { chatId },
        payload: {
          kind: 'alert',
          text: `出站消息永久失败：${reason}`,
        },
        idempotencyKey: `gone-alert:${message.id}`,
        now,
      });
    } catch (error) {
      this.logger.warn(
        `出站失败告警入队失败：${
          error instanceof Error ? error.message : '未知错误'
        }`,
      );
    }
  }

  /** 出站永久失败审计：写失败只记录日志，不影响派发。 */
  private async auditGone(
    messageId: string,
    instanceId: string,
    reason: string,
    now: Date,
  ): Promise<void> {
    try {
      await this.audit.record({
        traceId: `outbound-${messageId}`,
        actorId: null,
        action: 'outbound.gone',
        method: 'WORKER',
        path: 'outbound',
        statusCode: 410,
        detail: { messageId, instanceId, reason },
        now,
      });
    } catch (error) {
      this.logger.warn(
        `出站 gone 审计写入失败：${
          error instanceof Error ? error.message : '未知错误'
        }`,
      );
    }
  }
}
