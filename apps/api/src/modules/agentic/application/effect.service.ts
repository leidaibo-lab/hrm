import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { EffectKind } from '../domain/effect.entity';
import { Effect } from '../domain/effect.entity';
import {
  EFFECT_REPOSITORY,
  type EffectRepository,
} from '../domain/effect.repository';

export const EFFECT_PENDING_TTL_MS = 120_000;

/** 副作用结果未知：pending 超时，需人工对账。 */
export class EffectUncertainError extends Error {
  constructor() {
    super('外部副作用结果未知，拒绝自动重发');
    this.name = 'EffectUncertainError';
  }
}

/** 执行副作用的输入。 */
export interface ExecuteEffectInput<T> {
  /** 幂等键。 */
  idempotencyKey: string;
  /** 副作用类型。 */
  kind: EffectKind;
  /** 目标标识。 */
  target: string;
  /** 真正的外部调用。 */
  run: () => Promise<T>;
  /** 当前时间；缺省为系统时间。 */
  now?: Date;
}

/** 执行副作用的结果。 */
export interface ExecuteEffectResult<T> {
  /** 调用结果。 */
  result: T;
  /** 是否重放已成功结果。 */
  replayed: boolean;
}

/**
 * 副作用用例：按幂等键串行化外部调用。
 * 成功结果重放；失败可重试；永久失败拒绝再次执行。
 */
@Injectable()
export class EffectService {
  constructor(
    @Inject(EFFECT_REPOSITORY) private readonly effects: EffectRepository,
  ) {}

  /** 执行一次幂等副作用。 */
  async execute<T>(
    input: ExecuteEffectInput<T>,
  ): Promise<ExecuteEffectResult<T>> {
    const existing = await this.effects.findByIdempotencyKey(
      input.idempotencyKey,
    );

    if (existing) {
      if (existing.status === 'succeeded')
        return { result: existing.result as T, replayed: true };
      if (existing.status === 'gone')
        throw new Error('副作用已永久失败，拒绝重试');
      if (existing.status === 'pending') {
        const age =
          (input.now ?? new Date()).getTime() - existing.createdAt.getTime();
        if (age > EFFECT_PENDING_TTL_MS) throw new EffectUncertainError();
        throw new Error('副作用正在执行，拒绝并发调用');
      }
      existing.retry();
      await this.effects.save(existing);
      return this.run(existing, input);
    }

    const effect = Effect.create({
      id: randomUUID(),
      idempotencyKey: input.idempotencyKey,
      kind: input.kind,
      target: input.target,
      now: input.now,
    });
    const created = await this.effects.create(effect);
    if (!created) return this.execute(input);
    return this.run(effect, input);
  }

  /** 把超时 pending 标记为 gone，返回清理数量；需人工确认外部结果。 */
  async reconcilePending(
    now: Date = new Date(),
    limit = 100,
  ): Promise<{ expired: number }> {
    const cutoff = new Date(now.getTime() - EFFECT_PENDING_TTL_MS);
    const rows = await this.effects.listPendingBefore(cutoff, limit);
    for (const effect of rows) {
      effect.markGone({ reason: 'pending_timeout' }, now);
      await this.effects.save(effect);
    }
    return { expired: rows.length };
  }

  private async run<T>(
    effect: Effect,
    input: ExecuteEffectInput<T>,
  ): Promise<ExecuteEffectResult<T>> {
    const now = input.now ?? new Date();
    try {
      const result = await input.run();
      effect.succeed(result, now);
      await this.effects.save(effect);
      return { result, replayed: false };
    } catch (error) {
      effect.fail(
        { message: error instanceof Error ? error.message : '未知错误' },
        now,
      );
      await this.effects.save(effect);
      throw error;
    }
  }
}
