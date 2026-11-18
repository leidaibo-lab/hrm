import { describe, expect, it } from 'vitest';
import type { IngestTriggerInput } from '../../../agentic/application/ingestion.service';
import { IngestionService } from '../../../agentic/application/ingestion.service';
import type { RouterService } from '../../../agentic/application/router.service';
import type { RoutingRolloutService } from '../../../agentic/application/routing-rollout.service';
import type { IngressRateLimitPort } from '../../domain/ingress-rate-limit.port';
import type { RoutingQueuePort } from '../../domain/routing-queue.port';
import { SourceInstance } from '../../domain/source-instance.entity';
import type { SourceInstanceRepository } from '../../domain/source-instance.repository';
import { LarkSource } from '../../infrastructure/lark/source.service';
import { IngressService } from '../ingress.service';
import type { SourceAuthorizationService } from '../source-authorization.service';
import type { SourceHealthService } from '../source-health.service';
import { SourceRegistry } from '../source-registry.service';

class FakeHealth {
  readonly marks: Array<{ instanceId: string; state: string }> = [];
  async mark(instanceId: string, _entry: string, state: string): Promise<void> {
    this.marks.push({ instanceId, state });
  }
}

class FakeRoutingQueue implements RoutingQueuePort {
  readonly jobs: Array<{ triggerId: string; sourceInstanceId: string }> = [];
  async enqueue(job: {
    triggerId: string;
    sourceInstanceId: string;
  }): Promise<void> {
    this.jobs.push(job);
  }
}

class FakeIngressRateLimit implements IngressRateLimitPort {
  allowed = true;
  async tryAcquire(): Promise<boolean> {
    return this.allowed;
  }
}

class FakeRollout {
  enabled = true;
  configured = false;
  async asyncEnabled(): Promise<boolean> {
    return this.enabled;
  }
  async decide(): Promise<{
    enabled: boolean;
    configured: boolean;
    reasons: string[];
  }> {
    return {
      enabled: this.enabled,
      configured: this.configured,
      reasons: this.enabled ? [] : ['disabled'],
    };
  }
}

class FakeAudit {
  readonly records: Array<{ action: string; detail: unknown }> = [];
  async record(input: { action: string; detail: unknown }): Promise<void> {
    this.records.push(input);
  }
}

class FakeAuthorization {
  allowed = true;
  async isAuthorized(): Promise<boolean> {
    return this.allowed;
  }
}

class FakeRouter {
  calls = 0;

  async route(): Promise<unknown> {
    this.calls += 1;
    return { route: 'filtered' };
  }
}

const AT = new Date('2026-11-16T00:00:00.000Z');

class FakeSourceInstanceRepository implements SourceInstanceRepository {
  constructor(private readonly instance: SourceInstance | null) {}
  async findById(id: string): Promise<SourceInstance | null> {
    return this.instance?.id === id ? this.instance : null;
  }
  async findByTypeAndName(): Promise<SourceInstance | null> {
    return null;
  }
  async list(): Promise<SourceInstance[]> {
    return [];
  }

  async save(): Promise<void> {}
}

class FakeIngestionService {
  calls = 0;
  last: IngestTriggerInput | null = null;

  async ingest(
    input: IngestTriggerInput,
  ): Promise<{ trigger: { id: string }; created: boolean }> {
    this.calls += 1;
    this.last = input;
    return { trigger: { id: 'trigger-1' }, created: true };
  }
}

const raw = {
  message_id: 'message-1',
  chat_id: 'chat-1',
  thread_id: 'thread-1',
  sender_id: 'user-1',
  text: '@agentic 补充验收标准',
  mentions_me: true,
};

function makeService(options: {
  instance?: SourceInstance | null;
  raw?: unknown;
}): {
  ingress: IngressService;
  ingestion: FakeIngestionService;
  router: FakeRouter;
  routing: FakeRoutingQueue;
  rateLimit: FakeIngressRateLimit;
  rollout: FakeRollout;
  authorization: FakeAuthorization;
  audit: FakeAudit;
} {
  const instance =
    options.instance === undefined
      ? SourceInstance.create({
          id: 'instance-1',
          sourceType: 'lark',
          name: '研发群',
          config: { chats: ['chat-1'], listen: 'mentions', botId: 'bot-1' },
          now: AT,
        })
      : options.instance;

  const registry = new SourceRegistry();
  registry.register(new LarkSource() as never);
  const ingestion = new FakeIngestionService();
  const router = new FakeRouter();
  const routing = new FakeRoutingQueue();
  const rateLimit = new FakeIngressRateLimit();
  const rollout = new FakeRollout();
  const authorization = new FakeAuthorization();
  const audit = new FakeAudit();
  const ingress = new IngressService(
    new FakeSourceInstanceRepository(instance),
    registry,
    ingestion as unknown as IngestionService,
    router as unknown as RouterService,
    new FakeHealth() as unknown as SourceHealthService,
    routing as unknown as RoutingQueuePort,
    rateLimit as unknown as IngressRateLimitPort,
    rollout as unknown as RoutingRolloutService,
    authorization as unknown as SourceAuthorizationService,
    audit as never,
  );
  return {
    ingress,
    ingestion,
    router,
    routing,
    rateLimit,
    rollout,
    authorization,
    audit,
  };
}

describe('IngressService.accept', () => {
  it('超出每秒配额时拒绝接收，交由来源重试', async () => {
    const { ingress, ingestion, rateLimit } = makeService({});
    rateLimit.allowed = false;

    const result = await ingress.accept({
      instanceId: 'instance-1',
      raw,
      now: AT,
    });

    expect(result).toEqual({ accepted: false, reason: 'rate_limited' });
    expect(ingestion.calls).toBe(0);
  });

  it('回调入口延迟路由：只入队，不同步研判', async () => {
    const { ingress, router, routing } = makeService({});

    const result = await ingress.accept({
      instanceId: 'instance-1',
      raw,
      now: AT,
      deferRouting: true,
    });

    expect(result).toEqual({
      accepted: true,
      triggerId: 'trigger-1',
      created: true,
      routed: 'queued',
    });
    expect(router.calls).toBe(0);
    expect(routing.jobs).toEqual([
      {
        triggerId: 'trigger-1',
        sourceInstanceId: 'instance-1',
        scopeRow: 'chat-1',
        addressed: true,
        actorId: 'user-1',
        sourceType: 'lark',
        scopeKey: 'chat-1',
        at: AT.toISOString(),
      },
    ]);
  });

  it('通过实例配置翻译并交给事件接入', async () => {
    const { ingress, ingestion, router } = makeService({});

    const result = await ingress.accept({
      instanceId: 'instance-1',
      raw,
      now: AT,
    });

    expect(result).toEqual({
      accepted: true,
      triggerId: 'trigger-1',
      created: true,
      routed: 'filtered',
    });
    expect(ingestion.calls).toBe(1);
    expect(ingestion.last?.threadKey).toBe('lark:chat-1:thread-1');
    expect(ingestion.last?.addressed).toBe('mention');
    expect(router.calls).toBe(1);
  });

  it('实例不存在时拒绝', async () => {
    const { ingress } = makeService({ instance: null });
    const result = await ingress.accept({ instanceId: 'missing', raw });
    expect(result).toEqual({
      accepted: false,
      reason: 'instance_not_found',
    });
  });

  it('实例停用时拒绝', async () => {
    const instance = SourceInstance.create({
      id: 'instance-1',
      sourceType: 'lark',
      name: '研发群',
      config: { chats: ['chat-1'], botId: 'bot-1' },
      enabled: false,
      now: AT,
    });
    const { ingress } = makeService({ instance });
    const result = await ingress.accept({ instanceId: 'instance-1', raw });
    expect(result).toEqual({ accepted: false, reason: 'instance_disabled' });
  });

  it('无法翻译时拒绝', async () => {
    const { ingress } = makeService({ raw: { message_id: 'x' } });
    const result = await ingress.accept({ instanceId: 'instance-1', raw: {} });
    expect(result).toEqual({ accepted: false, reason: 'untranslatable' });
  });

  it('群不在范围时拒绝', async () => {
    const { ingress } = makeService({});
    const result = await ingress.accept({
      instanceId: 'instance-1',
      raw: { ...raw, chat_id: 'chat-2' },
    });
    expect(result).toEqual({ accepted: false, reason: 'out_of_scope' });
  });
});

describe('IngressService 灰度回退', () => {
  it('异步路由关闭时回退同步路由', async () => {
    const { ingress, router, routing, rollout } = makeService({});
    rollout.enabled = false;

    const result = await ingress.accept({
      instanceId: 'instance-1',
      raw,
      now: AT,
      deferRouting: true,
    });

    expect(result).toMatchObject({ accepted: true, routed: 'filtered' });
    expect(router.calls).toBe(1);
    expect(routing.jobs).toEqual([]);
  });
});

describe('IngressService 来源授权', () => {
  it('授权失效时拒绝接收', async () => {
    const { ingress, ingestion, authorization } = makeService({});
    authorization.allowed = false;

    const result = await ingress.accept({
      instanceId: 'instance-1',
      raw,
      now: AT,
    });

    expect(result).toEqual({ accepted: false, reason: 'unauthorized' });
    expect(ingestion.calls).toBe(0);
  });

  it('灰度命中写审计并在未命中时回退同步路由', async () => {
    const { ingress, router, routing, rollout, audit } = makeService({});
    rollout.configured = true;
    rollout.enabled = false;

    const result = await ingress.accept({
      instanceId: 'instance-1',
      raw,
      deferRouting: true,
    });

    expect(result).toMatchObject({ accepted: true, routed: 'filtered' });
    expect(router.calls).toBe(1);
    expect(routing.jobs).toHaveLength(0);
    expect(audit.records).toHaveLength(1);
    expect(audit.records[0].action).toBe('routing.rollout');
    expect(audit.records[0].detail).toMatchObject({
      role: 'assess',
      enabled: false,
      reasons: ['disabled'],
    });
  });
});
