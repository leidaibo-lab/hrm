import { describe, expect, it } from 'vitest';
import { Trigger } from '../../domain/trigger.entity';
import type { TriggerRepository } from '../../domain/trigger.repository';
import type { RouterService } from '../router.service';
import { RoutingService } from '../routing.service';

const AT = new Date('2026-11-16T00:00:00.000Z');

class FakeTriggerRepository implements TriggerRepository {
  constructor(private readonly trigger: Trigger | null) {}
  async findByDedupeKey(): Promise<Trigger | null> {
    return null;
  }
  async create(): Promise<boolean> {
    return true;
  }
  async listByThread(): Promise<Trigger[]> {
    return [];
  }
  async listByIds(): Promise<Trigger[]> {
    return this.trigger ? [this.trigger] : [];
  }
  async saveDisposition(): Promise<void> {}
}

class FakeRouter {
  calls = 0;
  async route(): Promise<{ route: 'filtered' }> {
    this.calls += 1;
    return { route: 'filtered' };
  }
}

function makeTrigger(disposition: 'pending' | 'filtered' = 'pending'): Trigger {
  const trigger = Trigger.create({
    id: 'trigger-1',
    dedupeKey: 'lark:1',
    sourceType: 'lark',
    instanceId: 'instance-1',
    threadId: 'thread-1',
    actorId: 'actor-1',
    text: '需求',
    payload: {},
    occurredAt: AT,
  });
  if (disposition === 'filtered') trigger.markFiltered(AT, 'denied');
  return trigger;
}

function makeService(trigger: Trigger | null): {
  service: RoutingService;
  router: FakeRouter;
} {
  const router = new FakeRouter();
  return {
    service: new RoutingService(
      new FakeTriggerRepository(trigger),
      router as unknown as RouterService,
    ),
    router,
  };
}

describe('RoutingService.routeTrigger', () => {
  it('待处理事件交给路由', async () => {
    const { service, router } = makeService(makeTrigger());

    await expect(
      service.routeTrigger({
        triggerId: 'trigger-1',
        sourceInstanceId: 'instance-1',
        scopeRow: 'chat-1',
        addressed: true,
        actorId: 'actor-1',
        sourceType: 'lark',
        now: AT,
      }),
    ).resolves.toEqual({ route: 'filtered' });
    expect(router.calls).toBe(1);
  });

  it('已处置事件直接跳过，保证重试幂等', async () => {
    const { service, router } = makeService(makeTrigger('filtered'));

    await expect(
      service.routeTrigger({
        triggerId: 'trigger-1',
        sourceInstanceId: 'instance-1',
        scopeRow: 'chat-1',
        addressed: true,
        actorId: 'actor-1',
        sourceType: 'lark',
        now: AT,
      }),
    ).resolves.toBeNull();
    expect(router.calls).toBe(0);
  });

  it('事件不存在时跳过', async () => {
    const { service } = makeService(null);
    await expect(
      service.routeTrigger({
        triggerId: 'missing',
        sourceInstanceId: 'instance-1',
        scopeRow: 'chat-1',
        addressed: true,
        actorId: 'actor-1',
        sourceType: 'lark',
      }),
    ).resolves.toBeNull();
  });
});
