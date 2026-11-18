import { describe, expect, it, vi } from 'vitest';
import { Decision } from '../../domain/decision.entity';
import { Policy } from '../../domain/policy.entity';
import type { RouterDecisionPort } from '../../domain/router-decision.port';
import type { Subscription } from '../../domain/subscription.entity';
import { Subscription as SubscriptionAggregate } from '../../domain/subscription.entity';
import type { SubscriptionRepository } from '../../domain/subscription.repository';
import { Trigger } from '../../domain/trigger.entity';
import type { TriggerRepository } from '../../domain/trigger.repository';
import type { AdmissionResult, AdmissionService } from '../admission.service';
import type { EvalService, EvaluateResult } from '../eval.service';
import { RouterService } from '../router.service';

const AT = new Date('2026-11-16T00:00:00.000Z');
const policy = Policy.create({
  id: 'policy-1',
  version: 3,
  acceptMode: 'explicit',
  rules: {},
  createdBy: 'admin',
  now: AT,
});

class FakeSubscriptionRepository implements SubscriptionRepository {
  constructor(private readonly subscribers: Subscription[]) {}
  async listByThread(): Promise<Subscription[]> {
    return this.subscribers;
  }
  async listByTicket(): Promise<Subscription[]> {
    return [];
  }
  async add(): Promise<void> {}
  async remove(): Promise<void> {}
}

class FakeTriggerRepository implements TriggerRepository {
  readonly saved: Trigger[] = [];
  constructor(private readonly pending: Trigger[] = []) {}
  async findByDedupeKey(): Promise<Trigger | null> {
    return null;
  }
  async create(): Promise<boolean> {
    return true;
  }
  async listByThread(): Promise<Trigger[]> {
    return this.pending;
  }

  async listByIds(): Promise<Trigger[]> {
    return [];
  }

  async saveDisposition(trigger: Trigger): Promise<void> {
    this.saved.push(trigger);
  }
}

function makeTrigger(): Trigger {
  return Trigger.create({
    id: 'trigger-1',
    dedupeKey: 'lark:1',
    sourceType: 'lark',
    instanceId: 'instance-1',
    threadId: 'thread-1',
    actorId: 'open-id-1',
    text: '需求内容',
    payload: {},
    occurredAt: AT,
    receivedAt: AT,
  });
}

function makeDecision(): Decision {
  return Decision.create({
    id: 'decision-1',
    threadId: 'thread-1',
    kind: 'accept',
    strength: 'explicit',
    scope: {},
    policyId: policy.id,
    policyVersion: policy.version,
    matchedRuleIds: ['rule-1'],
    reason: '信息完整',
    triggerIds: ['trigger-1'],
    now: AT,
  });
}

function makeRouter(options: {
  subscribers?: Subscription[];
  admission?: AdmissionResult;
  evaluation?: EvaluateResult;
  pending?: Trigger[];
  routerDecision?: RouterDecisionPort;
  evalLock?: {
    tryAcquire: () => Promise<{ release: () => Promise<void> } | null>;
  };
  evalError?: Error;
}): {
  router: RouterService;
  triggers: FakeTriggerRepository;
  calls: { admission: number; evaluation: number; batch: number };
} {
  const triggers = new FakeTriggerRepository(options.pending ?? []);
  const calls = { admission: 0, evaluation: 0, batch: 0 };
  const admission = {
    evaluate: async (): Promise<AdmissionResult> => {
      calls.admission += 1;
      return (
        options.admission ?? {
          admitted: false,
          reason: 'no_policy',
          policyId: null,
          policyVersion: null,
          cell: null,
          policy: null,
        }
      );
    },
  } as unknown as AdmissionService;
  const evaluation = {
    evaluate: async (input: {
      triggers: Trigger[];
    }): Promise<EvaluateResult> => {
      calls.evaluation += 1;
      calls.batch = input.triggers.length;
      if (options.evalError) throw options.evalError;
      return options.evaluation ?? { decision: makeDecision() };
    },
  } as unknown as EvalService;
  const router = new RouterService(
    new FakeSubscriptionRepository(options.subscribers ?? []),
    triggers,
    admission,
    evaluation,
    (options.evalLock ?? {
      tryAcquire: async () => ({ release: async () => undefined }),
    }) as never,
    options.routerDecision,
  );
  return { router, triggers, calls };
}

function makeInput(): Parameters<RouterService['route']>[0] {
  return {
    trigger: makeTrigger(),
    threadId: 'thread-1',
    sourceInstanceId: 'instance-1',
    scopeRow: 'project-a',
    actorListed: true,
    addressed: false,
    actorId: 'open-id-1',
    sourceType: 'lark',
    scope: {},
    now: AT,
  };
}

describe('RouterService.route', () => {
  it('已订阅时直通，不进入准入与研判', async () => {
    const subscriber = SubscriptionAggregate.create({
      ticketId: 'ticket-1',
      threadId: 'thread-1',
      reason: 'started',
      now: AT,
    });
    const { router, triggers, calls } = makeRouter({
      subscribers: [subscriber],
    });

    const result = await router.route(makeInput());

    expect(result.route).toBe('fanout');
    expect(calls.admission).toBe(0);
    expect(calls.evaluation).toBe(0);
    expect(triggers.saved[0].disposition).toBe('fanned_out');
  });

  it('未订阅且准入拒绝时过滤事件', async () => {
    const { router, triggers, calls } = makeRouter({
      admission: {
        admitted: false,
        reason: 'denied',
        policyId: policy.id,
        policyVersion: policy.version,
        cell: 'unlisted_unaddressed',
        policy,
      },
    });

    const result = await router.route(makeInput());

    expect(result.route).toBe('filtered');
    expect(calls.evaluation).toBe(0);
    expect(triggers.saved[0].disposition).toBe('filtered');
    expect(triggers.saved[0].filterReason).toBe('denied');
  });

  it('未订阅且准入通过时进入研判', async () => {
    const { router, calls } = makeRouter({
      admission: {
        admitted: true,
        reason: 'admitted',
        policyId: policy.id,
        policyVersion: policy.version,
        cell: null,
        policy,
      },
    });

    const result = await router.route(makeInput());

    expect(result.route).toBe('evaluated');
    expect(calls.admission).toBe(1);
    expect(calls.evaluation).toBe(1);
  });
});

describe('RouterService 批合并', () => {
  it('同线程 pending 事件合并进本批评判', async () => {
    const pending = Trigger.create({
      id: 'trigger-2',
      dedupeKey: 'lark:2',
      sourceType: 'lark',
      instanceId: 'instance-1',
      threadId: 'thread-1',
      actorId: 'actor-1',
      text: '补充',
      payload: {},
      occurredAt: new Date(AT.getTime() + 1_000),
    });
    const { router, calls } = makeRouter({
      pending: [pending],
      admission: {
        admitted: true,
        reason: 'admitted',
        policyId: policy.id,
        policyVersion: policy.version,
        cell: 'listed_unaddressed',
        policy,
      },
    });

    await router.route(makeInput());

    expect(calls.evaluation).toBe(1);
    expect(calls.batch).toBe(2);
  });

  it('Router 慢路径开启且判定不值得时过滤事件', async () => {
    const calls: number[] = [];
    const {
      router,
      triggers,
      calls: evalCalls,
    } = makeRouter({
      admission: {
        admitted: true,
        reason: 'admitted',
        policyId: policy.id,
        policyVersion: policy.version,
        cell: null,
        policy: Policy.create({
          id: 'policy-router',
          version: 4,
          acceptMode: 'explicit',
          rules: { routerAgentEnabled: true },
          createdBy: 'admin',
          now: AT,
        }),
      },
      routerDecision: {
        decide: async () => {
          calls.push(1);
          return { relevant: true, worthProcessing: false, reason: '闲聊' };
        },
      },
    });

    const result = await router.route(makeInput());

    expect(result.route).toBe('filtered');
    expect(calls).toHaveLength(1);
    expect(evalCalls.evaluation).toBe(0);
    expect(triggers.saved[0].filterReason).toContain('router_agent');
  });

  it('Router 慢路径不可用时回退确定性研判', async () => {
    const { router, calls } = makeRouter({
      admission: {
        admitted: true,
        reason: 'admitted',
        policyId: policy.id,
        policyVersion: policy.version,
        cell: null,
        policy: Policy.create({
          id: 'policy-router',
          version: 4,
          acceptMode: 'explicit',
          rules: { routerAgentEnabled: true },
          createdBy: 'admin',
          now: AT,
        }),
      },
      routerDecision: { decide: async () => null },
    });

    const result = await router.route(makeInput());

    expect(result.route).toBe('evaluated');
    expect(calls.evaluation).toBe(1);
  });

  it('Eval 锁繁忙时重试，获取后释放', async () => {
    vi.useFakeTimers();
    let attempts = 0;
    let releases = 0;
    const evalLock = {
      tryAcquire: async () => {
        attempts += 1;
        if (attempts < 3) return null;
        return {
          release: async () => {
            releases += 1;
          },
        };
      },
    };
    const subscriber = SubscriptionAggregate.create({
      ticketId: 'ticket-1',
      threadId: 'thread-1',
      reason: 'started',
      now: AT,
    });
    const { router } = makeRouter({ subscribers: [subscriber], evalLock });

    const pending = router.route(makeInput());
    await vi.advanceTimersByTimeAsync(250);
    const result = await pending;

    expect(result.route).toBe('fanout');
    expect(attempts).toBe(3);
    expect(releases).toBe(1);
    vi.useRealTimers();
  });

  it('研判抛错时仍释放 Eval 锁', async () => {
    let releases = 0;
    const { router } = makeRouter({
      admission: {
        admitted: true,
        reason: 'admitted',
        policyId: policy.id,
        policyVersion: policy.version,
        cell: null,
        policy,
      },
      evalError: new Error('研判失败'),
      evalLock: {
        tryAcquire: async () => ({
          release: async () => {
            releases += 1;
          },
        }),
      },
    });

    await expect(router.route(makeInput())).rejects.toThrow('研判失败');
    expect(releases).toBe(1);
  });
});
