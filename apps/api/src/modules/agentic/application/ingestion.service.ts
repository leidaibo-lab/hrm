import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { metrics } from '../domain/metrics.port';
import type { Addressed, Trigger } from '../domain/trigger.entity';
import { Trigger as TriggerAggregate } from '../domain/trigger.entity';
import {
  TRIGGER_REPOSITORY,
  type TriggerRepository,
} from '../domain/trigger.repository';
import { ThreadService } from './thread.service';

/** 事件接入的输入：来源元数据 + 线程键 + 负载。 */
export interface IngestTriggerInput {
  /** 来源类型（lark/zentao/gitlab）。 */
  sourceType: string;
  /** 幂等键，来源内稳定。 */
  dedupeKey: string;
  /** 源实例主键。 */
  instanceId: string;
  /** 来源内稳定线程键。 */
  threadKey: string;
  /** 项目或空间标识。 */
  scopeKey?: string | null;
  /** 源内操作者标识。 */
  actorId: string;
  /** 平台用户标识。 */
  actorUserId?: string | null;
  /** 是否点名机器人。 */
  addressed?: Addressed | null;
  /** 事件文本。 */
  text: string;
  /** 原始负载。 */
  payload: unknown;
  /** 事件发生时间。 */
  occurredAt: Date;
  /** 当前时间；缺省为系统时间。 */
  now?: Date;
}

/** 事件接入的结果：幂等命中时 created 为 false。 */
export interface IngestTriggerResult {
  /** 事件聚合（新建或已存在）。 */
  trigger: Trigger;
  /** 本次是否新建。 */
  created: boolean;
}

/** 事件接入用例：解析线程、按幂等键创建事件。 */
@Injectable()
export class IngestionService {
  constructor(
    private readonly threads: ThreadService,
    @Inject(TRIGGER_REPOSITORY)
    private readonly triggers: TriggerRepository,
  ) {}

  /** 接入一条事件；重复投递返回原事件。 */
  async ingest(input: IngestTriggerInput): Promise<IngestTriggerResult> {
    const existing = await this.triggers.findByDedupeKey(input.dedupeKey);
    if (existing) return { trigger: existing, created: false };

    const thread = await this.threads.ensureOpen({
      sourceType: input.sourceType,
      externalKey: input.threadKey,
      scopeKey: input.scopeKey,
      now: input.now,
    });

    const trigger = TriggerAggregate.create({
      id: randomUUID(),
      dedupeKey: input.dedupeKey,
      sourceType: input.sourceType,
      instanceId: input.instanceId,
      threadId: thread.id,
      scopeKey: input.scopeKey,
      actorId: input.actorId,
      actorUserId: input.actorUserId,
      addressed: input.addressed,
      text: input.text,
      payload: input.payload,
      occurredAt: input.occurredAt,
      receivedAt: input.now,
    });

    const created = await this.triggers.create(trigger);
    if (created) {
      metrics.increment('agentic_events_total', { event: 'trigger_received' });
      return { trigger, created: true };
    }

    const duplicate = await this.triggers.findByDedupeKey(input.dedupeKey);
    if (!duplicate) throw new Error('事件幂等冲突但未找到原记录');
    return { trigger: duplicate, created: false };
  }
}
