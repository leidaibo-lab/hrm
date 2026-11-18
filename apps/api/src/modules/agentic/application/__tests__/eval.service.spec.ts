import { describe, expect, it } from 'vitest';
import type { AcceptanceRepository } from '../../domain/acceptance.repository';
import type {
  AssessmentPort,
  AssessmentResult,
} from '../../domain/assessment.port';
import type { ClarificationJob } from '../../domain/clarification-queue.port';
import type { Decision } from '../../domain/decision.entity';
import type { DecisionRepository } from '../../domain/decision.repository';
import { Policy } from '../../domain/policy.entity';
import { Trigger } from '../../domain/trigger.entity';
import type { TriggerRepository } from '../../domain/trigger.repository';
import { AcceptanceService } from '../acceptance.service';
import { EvalService } from '../eval.service';

const AT = new Date('2026-11-16T00:00:00.000Z');

const policy = Policy.create({
  id: 'policy-1',
  version: 3,
  acceptMode: 'explicit',
  rules: {},
  createdBy: 'admin',
  now: AT,
});

class FakeAssessment implements AssessmentPort {
  constructor(private readonly result: AssessmentResult) {}
  async assess(): Promise<AssessmentResult> {
    return this.result;
  }
}

class FakeDecisionRepository implements DecisionRepository {
  readonly rows: Decision[] = [];
  async findById(id: string): Promise<Decision | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }
  async listByThread(threadId: string): Promise<Decision[]> {
    return this.rows.filter((decision) => decision.threadId === threadId);
  }

  async create(decision: Decision): Promise<void> {
    this.rows.push(decision);
  }
}

class FakeTriggerRepository implements TriggerRepository {
  readonly saved: Trigger[] = [];
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
    return [];
  }

  async saveDisposition(trigger: Trigger): Promise<void> {
    this.saved.push(trigger);
  }
}

class FakeClarificationQueue {
  readonly jobs: ClarificationJob[] = [];
  async enqueue(job: ClarificationJob): Promise<void> {
    this.jobs.push(job);
  }
}

class FakeAcceptanceRepository implements AcceptanceRepository {
  calls = 0;
  async accept(): Promise<void> {
    this.calls += 1;
  }
}

function makeTrigger(id: string): Trigger {
  return Trigger.create({
    id,
    dedupeKey: `lark:${id}`,
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

function makeService(result: AssessmentResult): {
  service: EvalService;
  decisions: FakeDecisionRepository;
  triggers: FakeTriggerRepository;
  acceptance: FakeAcceptanceRepository;
  clarificationQueue: FakeClarificationQueue;
} {
  const decisions = new FakeDecisionRepository();
  const triggers = new FakeTriggerRepository();
  const acceptance = new FakeAcceptanceRepository();
  const clarificationQueue = new FakeClarificationQueue();
  const service = new EvalService(
    new FakeAssessment(result),
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
  return { service, decisions, triggers, acceptance, clarificationQueue };
}

const acceptResult: AssessmentResult = {
  kind: 'accept',
  strength: 'explicit',
  scope: { projectKey: 'project-a' },
  matchedRuleIds: ['rule-1'],
  reason: '信息完整',
  ticketKind: 'requirement',
};

describe('EvalService.evaluate', () => {
  it('结论为 accept 时走接单事务并返回工单', async () => {
    const { service, triggers, acceptance, clarificationQueue } =
      makeService(acceptResult);
    const batch = [makeTrigger('trigger-1'), makeTrigger('trigger-2')];

    const result = await service.evaluate({
      threadId: 'thread-1',
      triggers: batch,
      policy,
      actorId: 'open-id-1',
      sourceType: 'lark',
      scope: acceptResult.scope,
      scopeKey: 'project-a',
      now: AT,
    });

    expect(result.decision.isAccepted).toBe(true);
    expect(result.ticket?.mandateId).toBe(result.mandate?.id);
    expect(acceptance.calls).toBe(1);
    expect(clarificationQueue.jobs).toHaveLength(1);
    expect(triggers.saved).toHaveLength(2);
    expect(triggers.saved[0].disposition).toBe('evaluated');
  });

  it('非 accept 只追加结论，不派生工单', async () => {
    const { service, decisions, triggers, acceptance, clarificationQueue } =
      makeService({
        ...acceptResult,
        kind: 'ignore',
        reason: '与需求无关',
      });

    const result = await service.evaluate({
      threadId: 'thread-1',
      triggers: [makeTrigger('trigger-1')],
      policy,
      actorId: 'open-id-1',
      sourceType: 'lark',
      scope: {},
      now: AT,
    });

    expect(result.decision.isAccepted).toBe(false);
    expect(result.ticket).toBeUndefined();
    expect(decisions.rows).toHaveLength(1);
    expect(acceptance.calls).toBe(0);
    expect(clarificationQueue.jobs).toHaveLength(0);
    expect(triggers.saved[0].disposition).toBe('evaluated');
  });

  it('已处置事件不重复迁移', async () => {
    const { service, triggers } = makeService(acceptResult);
    const trigger = makeTrigger('trigger-1');
    trigger.markFiltered(AT);

    await service.evaluate({
      threadId: 'thread-1',
      triggers: [trigger],
      policy,
      actorId: 'open-id-1',
      sourceType: 'lark',
      scope: {},
      now: AT,
    });

    expect(triggers.saved).toHaveLength(0);
  });

  it('空批次直接拒绝', async () => {
    const { service } = makeService(acceptResult);
    await expect(
      service.evaluate({
        threadId: 'thread-1',
        triggers: [],
        policy,
        actorId: 'open-id-1',
        sourceType: 'lark',
        scope: {},
      }),
    ).rejects.toThrow('研判批次不能为空');
  });
});
