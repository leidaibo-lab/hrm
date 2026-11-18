import { describe, expect, it } from 'vitest';
import { EffectService } from '../../../agentic/application/effect.service';
import type { PolicyService } from '../../../agentic/application/policy.service';
import type { Effect } from '../../../agentic/domain/effect.entity';
import type { EffectRepository } from '../../../agentic/domain/effect.repository';
import { OutboundMessage } from '../../domain/outbound-message.entity';
import type { OutboundMessageRepository } from '../../domain/outbound-message.repository';
import {
  type OutboundTransport,
  PermanentOutboundError,
} from '../../domain/outbound-transport.port';
import type { SourceType } from '../../domain/source-adapter.port';
import { SourceInstance } from '../../domain/source-instance.entity';
import type { SourceInstanceRepository } from '../../domain/source-instance.repository';
import { OutboundService } from '../outbound.service';
import { OutboundDispatcherService } from '../outbound-dispatcher.service';
import { OutboundTransportRegistry } from '../outbound-transport.service';
import type { SourceHealthService } from '../source-health.service';

const AT = new Date('2026-11-16T00:00:00.000Z');

class FakeOutboundMessageRepository implements OutboundMessageRepository {
  readonly rows = new Map<string, OutboundMessage>();

  async findById(id: string): Promise<OutboundMessage | null> {
    return this.rows.get(id) ?? null;
  }
  async findByIdempotencyKey(): Promise<OutboundMessage | null> {
    return null;
  }
  async listDue(at: Date, limit: number): Promise<OutboundMessage[]> {
    return [...this.rows.values()]
      .filter((message) => message.isDue(at))
      .slice(0, limit);
  }
  async save(message: OutboundMessage): Promise<void> {
    this.rows.set(message.id, message);
  }
}

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

class FakePolicyService {
  constructor(private readonly chatId: string | null = null) {}
  async goneNotifyChatId(): Promise<string | undefined> {
    return this.chatId ?? undefined;
  }
}

class FakeEffectRepository implements EffectRepository {
  readonly rows = new Map<string, Effect>();
  async findByIdempotencyKey(key: string): Promise<Effect | null> {
    return this.rows.get(key) ?? null;
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

class FakeRateLimit {
  calls = 0;
  limit = Number.POSITIVE_INFINITY;

  async tryAcquire(): Promise<boolean> {
    this.calls += 1;
    return this.calls <= this.limit;
  }
}

class FakeFailureCounter {
  count = 0;
  async increment(): Promise<number> {
    this.count += 1;
    return this.count;
  }
  async reset(): Promise<void> {
    this.count = 0;
  }
}

class FakeHealth {
  readonly marks: Array<{ instanceId: string; state: string }> = [];
  async mark(instanceId: string, _entry: string, state: string): Promise<void> {
    this.marks.push({ instanceId, state });
  }
}

class FakeTransport implements OutboundTransport {
  readonly type: SourceType = 'lark';
  calls = 0;
  error: Error | null = null;

  async send(): Promise<void> {
    this.calls += 1;
    if (this.error) throw this.error;
  }
}

function makeService(options: {
  error?: Error;
  rateLimit?: number;
  policyRules?: Record<string, unknown> | null;
}): {
  dispatcher: OutboundDispatcherService;
  messages: FakeOutboundMessageRepository;
  transport: FakeTransport;
  rateLimit: FakeRateLimit;
  failures: FakeFailureCounter;
  instance: SourceInstance;
  health: FakeHealth;
  effects: FakeEffectRepository;
  policies: FakePolicyService;
} {
  const messages = new FakeOutboundMessageRepository();
  const instance = SourceInstance.create({
    id: 'instance-1',
    sourceType: 'lark',
    name: '研发群',
    config: {},
    now: AT,
  });
  const transport = new FakeTransport();
  transport.error = options.error ?? null;
  const effects = new FakeEffectRepository();
  const policies = new FakePolicyService(
    (options.policyRules?.goneNotifyChatId as string | undefined) ?? null,
  );
  const registry = new OutboundTransportRegistry();
  registry.register(transport);
  const outbound = new OutboundService(messages);
  const rateLimit = new FakeRateLimit();
  if (options.rateLimit !== undefined) rateLimit.limit = options.rateLimit;
  const failures = new FakeFailureCounter();
  const health = new FakeHealth();
  messages.rows.set(
    'outbound-1',
    OutboundMessage.create({
      id: 'outbound-1',
      instanceId: 'instance-1',
      address: { chatId: 'chat-1' },
      payload: { text: '已收到' },
      idempotencyKey: 'reply:1',
      now: AT,
    }),
  );

  return {
    dispatcher: new OutboundDispatcherService(
      messages,
      new FakeSourceInstanceRepository(instance),
      registry,
      outbound,
      health as unknown as SourceHealthService,
      rateLimit as never,
      failures as never,
      { increment: () => undefined } as never,
      { record: async () => ({}) } as never,
      { raiseOutboundFailure: async () => null } as never,
      new EffectService(effects),
      policies as unknown as PolicyService,
    ),
    messages,
    transport,
    rateLimit,
    failures,
    instance,
    health,
    effects,
    policies,
  };
}

describe('OutboundDispatcherService.dispatchDue', () => {
  it('发送成功推进为 sent 并记录副作用', async () => {
    const { dispatcher, messages, effects } = makeService({});
    const result = await dispatcher.dispatchDue(20, AT);
    expect(result.sent).toBe(1);
    expect(messages.rows.get('outbound-1')?.status).toBe('sent');
    expect(effects.rows.get('reply:1')?.status).toBe('succeeded');
  });

  it('永久失败推进为 gone', async () => {
    const { dispatcher, messages } = makeService({
      error: new PermanentOutboundError('chat deleted'),
    });
    const result = await dispatcher.dispatchDue(20, AT);
    expect(result.gone).toBe(1);
    expect(messages.rows.get('outbound-1')?.status).toBe('gone');
  });

  it('可重试失败记录次数并保留 pending', async () => {
    const { dispatcher, messages } = makeService({
      error: new Error('timeout'),
    });
    const result = await dispatcher.dispatchDue(20, AT);
    const saved = messages.rows.get('outbound-1');
    expect(result.failed).toBe(1);
    expect(saved?.status).toBe('pending');
    expect(saved?.attempts).toBe(1);
  });
});

describe('OutboundDispatcherService 限速', () => {
  it('超出来源每秒配额时停止本轮派发并保留 pending', async () => {
    const { dispatcher, messages, transport } = makeService({ rateLimit: 1 });
    messages.rows.set(
      'outbound-2',
      OutboundMessage.create({
        id: 'outbound-2',
        instanceId: 'instance-1',
        address: { chatId: 'chat-1' },
        payload: { text: '第二条' },
        idempotencyKey: 'reply:2',
        now: AT,
      }),
    );

    const result = await dispatcher.dispatchDue(20, AT);

    expect(result.sent).toBe(1);
    expect(transport.calls).toBe(1);
    expect(messages.rows.get('outbound-2')?.status).toBe('pending');
  });
});

describe('OutboundDispatcherService 连续失败暂停', () => {
  it('连续失败达到阈值时暂停来源并写健康异常', async () => {
    const { dispatcher, failures, instance, transport, health } = makeService({
      error: new Error('飞书 500'),
    });
    failures.count = 9;

    const result = await dispatcher.dispatchDue(20, AT);

    expect(result.failed).toBe(1);
    expect(transport.calls).toBe(1);
    expect(instance.isEnabled).toBe(false);
    expect(failures.count).toBe(10);
    expect(health.marks.at(-1)?.state).toBe('error');
  });

  it('发送失败时副作用记录为可重试失败', async () => {
    const { dispatcher, effects } = makeService({
      error: new Error('网络失败'),
    });

    const result = await dispatcher.dispatchDue(20, AT);

    expect(result.failed).toBe(1);
    expect(effects.rows.get('reply:1')?.status).toBe('failed');
  });

  it('配置告警目标时永久失败入队一次去重告警', async () => {
    const { dispatcher, messages, transport } = makeService({
      error: new PermanentOutboundError('目标不存在'),
      policyRules: { goneNotifyChatId: 'alert-chat' },
    });

    await dispatcher.dispatchDue(20, AT);

    const alert = [...messages.rows.values()].find(
      (message) => message.idempotencyKey === 'gone-alert:outbound-1',
    );
    expect(alert).toBeDefined();
    expect(alert?.address).toEqual({ chatId: 'alert-chat' });

    transport.error = null;
    await dispatcher.dispatchDue(20, AT);
    expect(transport.calls).toBe(2);
    expect(
      [...messages.rows.values()].filter((message) =>
        message.idempotencyKey.startsWith('gone-alert:'),
      ),
    ).toHaveLength(1);
  });
});
