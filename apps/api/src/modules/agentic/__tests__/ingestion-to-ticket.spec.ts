import { describe, expect, it } from 'vitest';
import { AcceptanceService } from '../application/acceptance.service';
import { AdmissionService } from '../application/admission.service';
import { EvalService } from '../application/eval.service';
import { IngestionService } from '../application/ingestion.service';
import { RouterService } from '../application/router.service';
import { ThreadService } from '../application/thread.service';
import type { AcceptanceRepository } from '../domain/acceptance.repository';
import { AdmissionRule } from '../domain/admission-rule.entity';
import type { AdmissionRuleRepository } from '../domain/admission-rule.repository';
import type {
  AssessmentPort,
  AssessmentResult,
} from '../domain/assessment.port';
import type { ClarificationJob } from '../domain/clarification-queue.port';
import type { Decision } from '../domain/decision.entity';
import type { DecisionRepository } from '../domain/decision.repository';
import { Policy } from '../domain/policy.entity';
import type { PolicyRepository } from '../domain/policy.repository';
import { Subscription } from '../domain/subscription.entity';
import type { SubscriptionRepository } from '../domain/subscription.repository';
import type { Thread } from '../domain/thread.entity';
import type { ThreadRepository } from '../domain/thread.repository';
import { Ticket } from '../domain/ticket.entity';
import { Trigger } from '../domain/trigger.entity';
import type { TriggerRepository } from '../domain/trigger.repository';

const AT = new Date('2026-11-16T00:00:00.000Z');

class Threads implements ThreadRepository {
  readonly rows = new Map<string, Thread>();
  async findById(id: string): Promise<Thread | null> {
    return this.rows.get(id) ?? null;
  }
  async findByExternalKey(
    sourceType: string,
    externalKey: string,
  ): Promise<Thread | null> {
    for (const thread of this.rows.values())
      if (
        thread.sourceType === sourceType &&
        thread.externalKey === externalKey
      )
        return thread;
    return null;
  }
  async list(): Promise<Thread[]> {
    return [...this.rows.values()];
  }
  async save(thread: Thread): Promise<void> {
    this.rows.set(thread.id, thread);
  }
}

class Triggers implements TriggerRepository {
  readonly rows = new Map<string, Trigger>();
  async findByDedupeKey(key: string): Promise<Trigger | null> {
    return this.rows.get(key) ?? null;
  }
  async create(trigger: Trigger): Promise<boolean> {
    if (this.rows.has(trigger.dedupeKey)) return false;
    this.rows.set(trigger.dedupeKey, trigger);
    return true;
  }
  async listByThread(threadId: string): Promise<Trigger[]> {
    return [...this.rows.values()].filter(
      (trigger) => trigger.threadId === threadId,
    );
  }
  async listByIds(): Promise<Trigger[]> {
    return [];
  }

  async saveDisposition(trigger: Trigger): Promise<void> {
    this.rows.set(trigger.dedupeKey, trigger);
  }
}

class Subscriptions implements SubscriptionRepository {
  constructor(private readonly rows: Subscription[] = []) {}
  async listByThread(): Promise<Subscription[]> {
    return this.rows;
  }
  async listByTicket(): Promise<Subscription[]> {
    return [];
  }
  async add(): Promise<void> {}
  async remove(): Promise<void> {}
}

class Policies implements PolicyRepository {
  constructor(private readonly policy: Policy | null) {}
  async findById(id: string): Promise<Policy | null> {
    return this.policy?.id === id ? this.policy : null;
  }
  async findCurrent(): Promise<Policy | null> {
    return this.policy;
  }
  async findByVersion(version: number): Promise<Policy | null> {
    return this.policy?.version === version ? this.policy : null;
  }
  async create(): Promise<void> {}
}

class AdmissionRules implements AdmissionRuleRepository {
  constructor(private readonly rows: AdmissionRule[]) {}
  async listByPolicy(): Promise<AdmissionRule[]> {
    return this.rows;
  }
  async find(input: {
    policyId: string;
    sourceInstanceId: string;
    scopeRow: string;
    cell: AdmissionRule['cell'];
  }): Promise<AdmissionRule | null> {
    return (
      this.rows.find(
        (rule) =>
          rule.policyId === input.policyId &&
          rule.sourceInstanceId === input.sourceInstanceId &&
          rule.scopeRow === input.scopeRow &&
          rule.cell === input.cell,
      ) ?? null
    );
  }
  async createMany(): Promise<void> {}
}

class Decisions implements DecisionRepository {
  readonly rows: Decision[] = [];
  async findById(id: string): Promise<Decision | null> {
    return this.rows.find((decision) => decision.id === id) ?? null;
  }
  async listByThread(threadId: string): Promise<Decision[]> {
    return this.rows.filter((decision) => decision.threadId === threadId);
  }

  async create(decision: Decision): Promise<void> {
    this.rows.push(decision);
  }
}

class Acceptance implements AcceptanceRepository {
  calls = 0;
  async accept(): Promise<void> {
    this.calls += 1;
  }
}

class ClarificationQueue {
  readonly jobs: ClarificationJob[] = [];
  async enqueue(job: ClarificationJob): Promise<void> {
    this.jobs.push(job);
  }
}

class Assessment implements AssessmentPort {
  async assess(): Promise<AssessmentResult> {
    return {
      kind: 'accept',
      strength: 'explicit',
      scope: { projectKey: 'project-a' },
      matchedRuleIds: null,
      reason: '信息完整',
      ticketKind: 'requirement',
    };
  }
}

const policy = Policy.create({
  id: 'policy-1',
  version: 1,
  acceptMode: 'explicit',
  rules: { allowedActors: ['open-id-1'] },
  createdBy: 'admin',
  now: AT,
});

const admissionRule = AdmissionRule.create({
  id: 'rule-1',
  policyId: policy.id,
  sourceInstanceId: 'instance-1',
  scopeRow: 'project-a',
  cell: 'listed_unaddressed',
  allowed: true,
  now: AT,
});

function makeStack(options?: {
  subscribers?: Subscription[];
  ruleAllowed?: boolean;
}): {
  ingestion: IngestionService;
  router: RouterService;
  triggers: Triggers;
  decisions: Decisions;
  acceptance: Acceptance;
  clarificationQueue: ClarificationQueue;
} {
  const threads = new Threads();
  const triggers = new Triggers();
  const decisions = new Decisions();
  const acceptance = new Acceptance();
  const clarificationQueue = new ClarificationQueue();
  const rule =
    options?.ruleAllowed === false
      ? AdmissionRule.create({
          id: 'rule-1',
          policyId: policy.id,
          sourceInstanceId: 'instance-1',
          scopeRow: 'project-a',
          cell: 'listed_unaddressed',
          allowed: false,
          now: AT,
        })
      : admissionRule;

  const threadService = new ThreadService(threads, triggers, {
    findById: async () => null,
    findByMandateId: async () => null,
    list: async () => [],
    listByThread: async () => [],
    save: async () => {},
  });
  const ingestion = new IngestionService(threadService, triggers);
  const admission = new AdmissionService(
    new Policies(policy),
    new AdmissionRules([rule]),
  );
  const evaluation = new EvalService(
    new Assessment(),
    decisions,
    triggers,
    new AcceptanceService(
      acceptance,
      {
        findById: async () => ({ scopeKey: 'project-a' }),
      } as never,
      { build: () => ({}) } as never,
    ),
    clarificationQueue,
  );
  const router = new RouterService(
    new Subscriptions(options?.subscribers ?? []),
    triggers,
    admission,
    evaluation,
    { tryAcquire: async () => ({ release: async () => undefined }) } as never,
  );
  return {
    ingestion,
    router,
    triggers,
    decisions,
    acceptance,
    clarificationQueue,
  };
}

async function ingest(ingestion: IngestionService): Promise<Trigger> {
  const result = await ingestion.ingest({
    sourceType: 'lark',
    dedupeKey: 'lark:message-1',
    instanceId: 'instance-1',
    threadKey: 'lark:chat-1:thread-1',
    scopeKey: 'project-a',
    actorId: 'open-id-1',
    text: '需要新增导出功能',
    payload: { messageId: 'message-1' },
    occurredAt: AT,
    now: AT,
  });
  return result.trigger;
}

describe('接入到工单', () => {
  it('名单内成员未点名 → 准入 → 研判 → 工单', async () => {
    const { ingestion, router, triggers, decisions, acceptance } = makeStack();
    const trigger = await ingest(ingestion);

    const routed = await router.route({
      trigger,
      threadId: trigger.threadId,
      sourceInstanceId: 'instance-1',
      scopeRow: 'project-a',
      actorId: 'open-id-1',
      addressed: false,
      sourceType: 'lark',
      scope: { projectKey: 'project-a' },
      now: AT,
    });

    expect(routed.route).toBe('evaluated');
    if (routed.route !== 'evaluated') throw new Error('未进入研判');
    expect(routed.evaluation.decision.isAccepted).toBe(true);
    expect(routed.evaluation.ticket).toBeInstanceOf(Ticket);
    expect(routed.evaluation.ticket?.mandateId).toBe(
      routed.evaluation.mandate?.id,
    );
    expect(acceptance.calls).toBe(1);
    expect(decisions.rows).toHaveLength(0);
    expect(triggers.rows.get('lark:message-1')?.disposition).toBe('evaluated');
  });

  it('准入拒绝时事件被过滤，不产生结论', async () => {
    const { ingestion, router, triggers, decisions } = makeStack({
      ruleAllowed: false,
    });
    const trigger = await ingest(ingestion);

    const routed = await router.route({
      trigger,
      threadId: trigger.threadId,
      sourceInstanceId: 'instance-1',
      scopeRow: 'project-a',
      actorId: 'open-id-1',
      addressed: false,
      sourceType: 'lark',
      scope: {},
      now: AT,
    });

    expect(routed.route).toBe('filtered');
    expect(decisions.rows).toHaveLength(0);
    expect(triggers.rows.get('lark:message-1')?.disposition).toBe('filtered');
  });

  it('已订阅线程直通，不进入准入与研判', async () => {
    const subscriber = Subscription.create({
      ticketId: 'ticket-1',
      threadId: 'thread-1',
      reason: 'started',
      now: AT,
    });
    const { ingestion, router, triggers, decisions } = makeStack({
      subscribers: [subscriber],
    });
    const trigger = await ingest(ingestion);

    const routed = await router.route({
      trigger,
      threadId: trigger.threadId,
      sourceInstanceId: 'instance-1',
      scopeRow: 'project-a',
      actorId: 'open-id-1',
      addressed: false,
      sourceType: 'lark',
      scope: {},
      now: AT,
    });

    expect(routed.route).toBe('fanout');
    expect(decisions.rows).toHaveLength(0);
    expect(triggers.rows.get('lark:message-1')?.disposition).toBe('fanned_out');
  });
});
