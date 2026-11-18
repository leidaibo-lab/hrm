import { describe, expect, it } from 'vitest';
import { Effect } from '../../domain/effect.entity';
import type { EffectRepository } from '../../domain/effect.repository';
import { EffectService, EffectUncertainError } from '../effect.service';

const AT = new Date('2026-11-16T00:00:00.000Z');

class FakeEffectRepository implements EffectRepository {
  readonly rows = new Map<string, Effect>();

  async findByIdempotencyKey(idempotencyKey: string): Promise<Effect | null> {
    return this.rows.get(idempotencyKey) ?? null;
  }
  async create(effect: Effect): Promise<boolean> {
    if (this.rows.has(effect.idempotencyKey)) return false;
    this.rows.set(effect.idempotencyKey, effect);
    return true;
  }
  async save(effect: Effect): Promise<void> {
    this.rows.set(effect.idempotencyKey, effect);
  }

  async listPendingBefore(cutoff: Date, limit: number): Promise<Effect[]> {
    return [...this.rows.values()]
      .filter(
        (effect) => effect.status === 'pending' && effect.createdAt < cutoff,
      )
      .slice(0, limit);
  }
}

const input = {
  idempotencyKey: 'issue:thread-1:1',
  kind: 'create_issue' as const,
  target: 'gitlab:project-a',
  now: AT,
};

describe('EffectService.execute', () => {
  it('首次执行调用外部并记录成功', async () => {
    const repository = new FakeEffectRepository();
    const service = new EffectService(repository);
    let calls = 0;

    const result = await service.execute({
      ...input,
      run: async () => {
        calls += 1;
        return { issueId: 42 };
      },
    });

    expect(result.replayed).toBe(false);
    expect(result.result).toEqual({ issueId: 42 });
    expect(calls).toBe(1);
    expect([...repository.rows.values()][0].status).toBe('succeeded');
  });

  it('成功后重放结果，不再调用外部', async () => {
    const repository = new FakeEffectRepository();
    const service = new EffectService(repository);
    let calls = 0;
    const run = async () => {
      calls += 1;
      return { issueId: 42 };
    };

    await service.execute({ ...input, run });
    const second = await service.execute({ ...input, run });

    expect(second.replayed).toBe(true);
    expect(calls).toBe(1);
  });

  it('失败后再次执行会重试并成功', async () => {
    const repository = new FakeEffectRepository();
    const service = new EffectService(repository);
    let calls = 0;
    const run = async () => {
      calls += 1;
      if (calls === 1) throw new Error('timeout');
      return { issueId: 42 };
    };

    await expect(service.execute({ ...input, run })).rejects.toThrow('timeout');
    const second = await service.execute({ ...input, run });

    expect(second.replayed).toBe(false);
    expect(calls).toBe(2);
  });

  it('永久失败拒绝再次执行', async () => {
    const repository = new FakeEffectRepository();
    const service = new EffectService(repository);
    await expect(
      service.execute({
        ...input,
        run: async () => {
          throw new Error('project deleted');
        },
      }),
    ).rejects.toThrow('project deleted');

    const saved = [...repository.rows.values()][0];
    saved.markGone({ message: 'project deleted' }, AT);
    repository.rows.set(saved.idempotencyKey, saved);

    await expect(
      service.execute({ ...input, run: async () => ({ issueId: 1 }) }),
    ).rejects.toThrow('永久失败');
  });

  it('pending 超时判为不确定，拒绝自动重发', async () => {
    const repository = new FakeEffectRepository();
    const service = new EffectService(repository);
    const pending = Effect.create({
      id: 'effect-1',
      idempotencyKey: input.idempotencyKey,
      kind: input.kind,
      target: input.target,
      now: new Date(AT.getTime() - 10 * 60_000),
    });
    repository.rows.set(pending.idempotencyKey, pending);

    await expect(
      service.execute({ ...input, run: async () => ({ issueId: 1 }) }),
    ).rejects.toBeInstanceOf(EffectUncertainError);
  });

  it('清理超时 pending 为 gone', async () => {
    const repository = new FakeEffectRepository();
    const service = new EffectService(repository);
    const pending = Effect.create({
      id: 'effect-stale',
      idempotencyKey: 'stale:1',
      kind: input.kind,
      target: input.target,
      now: new Date(AT.getTime() - 10 * 60_000),
    });
    repository.rows.set(pending.idempotencyKey, pending);

    await expect(service.reconcilePending(AT)).resolves.toEqual({ expired: 1 });
    expect(repository.rows.get('stale:1')?.status).toBe('gone');
  });
});
