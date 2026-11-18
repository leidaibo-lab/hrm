import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { OutboundMessage } from '../domain/outbound-message.entity';
import {
  OUTBOUND_MESSAGE_REPOSITORY,
  type OutboundMessageRepository,
} from '../domain/outbound-message.repository';

/** 最大尝试次数；达到后转永久失败。 */
const MAX_ATTEMPTS = 5;
/** 首次重试延迟（毫秒）。 */
const BASE_DELAY_MS = 30_000;
/** 单次重试延迟上限（毫秒）。 */
const MAX_DELAY_MS = 3_600_000;

/** 入队输入。 */
export interface EnqueueOutboundInput {
  /** 来源实例主键。 */
  instanceId: string;
  /** 目标地址主键。 */
  targetId?: string | null;
  /** 地址负载。 */
  address: unknown;
  /** 消息负载。 */
  payload: unknown;
  /** 幂等键。 */
  idempotencyKey: string;
  /** 当前时间；缺省为系统时间。 */
  now?: Date;
}

/** 入队结果。 */
export interface EnqueueOutboundResult {
  /** 消息聚合。 */
  message: OutboundMessage;
  /** 是否本次新建。 */
  created: boolean;
}

/** 出站用例：幂等入队与失败退避。 */
@Injectable()
export class OutboundService {
  constructor(
    @Inject(OUTBOUND_MESSAGE_REPOSITORY)
    private readonly messages: OutboundMessageRepository,
  ) {}

  /** 幂等入队；重复键返回原消息。 */
  async enqueue(input: EnqueueOutboundInput): Promise<EnqueueOutboundResult> {
    const existing = await this.messages.findByIdempotencyKey(
      input.idempotencyKey,
    );
    if (existing) return { message: existing, created: false };

    const message = OutboundMessage.create({
      id: randomUUID(),
      instanceId: input.instanceId,
      targetId: input.targetId,
      address: input.address,
      payload: input.payload,
      idempotencyKey: input.idempotencyKey,
      now: input.now,
    });
    await this.messages.save(message);
    return { message, created: true };
  }

  /** 标记发送成功。 */
  async recordSent(id: string, now: Date = new Date()): Promise<void> {
    const message = await this.load(id);
    message.markSent(now);
    await this.messages.save(message);
  }

  /** 标记永久失败。 */
  async recordGone(
    id: string,
    error: string,
    now: Date = new Date(),
  ): Promise<void> {
    const message = await this.load(id);
    message.markGone(error, now);
    await this.messages.save(message);
  }

  /** 记录一次可重试失败；达到上限转永久失败。 */
  async recordFailure(
    id: string,
    error: string,
    now: Date = new Date(),
  ): Promise<void> {
    const message = await this.load(id);
    const nextAttempts = message.attempts + 1;
    if (nextAttempts >= MAX_ATTEMPTS) {
      message.markGone(error, now);
    } else {
      message.markFailure(error, this.nextAttemptAt(now, nextAttempts), now);
    }
    await this.messages.save(message);
  }

  private async load(id: string): Promise<OutboundMessage> {
    const message = await this.messages.findById(id);
    if (!message) throw new Error(`出站消息不存在：${id}`);
    return message;
  }

  /** 指数退避：30s、60s、120s、240s，上限 1h。 */
  private nextAttemptAt(now: Date, attempt: number): Date {
    const delay = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);
    return new Date(now.getTime() + delay);
  }
}
