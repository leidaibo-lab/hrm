import { describe, expect, it } from 'vitest';
import { Artifact } from '../../domain/artifact.entity';
import type { ArtifactRepository } from '../../domain/artifact.repository';
import { Assignment } from '../../domain/assignment.entity';
import type { AssignmentRepository } from '../../domain/assignment.repository';
import { Attention } from '../../domain/attention.entity';
import type { AttentionRepository } from '../../domain/attention.repository';
import { Decision } from '../../domain/decision.entity';
import type { DecisionRepository } from '../../domain/decision.repository';
import { Policy } from '../../domain/policy.entity';
import type { PolicyRepository } from '../../domain/policy.repository';
import { Report } from '../../domain/report.entity';
import type { ReportRepository } from '../../domain/report.repository';
import { Thread } from '../../domain/thread.entity';
import type { ThreadRepository } from '../../domain/thread.repository';
import { Ticket } from '../../domain/ticket.entity';
import type { TicketRepository } from '../../domain/ticket.repository';
import { Trigger } from '../../domain/trigger.entity';
import type { TriggerRepository } from '../../domain/trigger.repository';
import { TimelineService } from '../timeline.service';

const AT = new Date('2026-11-16T00:00:00.000Z');
const LATER = new Date('2026-11-16T01:00:00.000Z');

class EmptyTicketRepository implements TicketRepository {
  async findById(): Promise<Ticket | null> {
    return Ticket.open({
      id: 'ticket-1',
      mandateId: 'mandate-1',
      threadId: 'thread-1',
      kind: 'requirement',
      now: AT,
    });
  }
  async findByMandateId(): Promise<Ticket | null> {
    return null;
  }
  async list(): Promise<Ticket[]> {
    return [];
  }
  async listByThread(): Promise<Ticket[]> {
    return [];
  }
  async save(): Promise<void> {}
}

class EmptyThreadRepository implements ThreadRepository {
  async findById(): Promise<Thread | null> {
    return Thread.open({
      id: 'thread-1',
      sourceType: 'lark',
      externalKey: 'lark:chat:thread',
      now: AT,
    });
  }
  async findByExternalKey(): Promise<Thread | null> {
    return null;
  }
  async list(): Promise<Thread[]> {
    return [];
  }
  async save(): Promise<void> {}
}

class FakeTriggerRepository implements TriggerRepository {
  async findByDedupeKey(): Promise<Trigger | null> {
    return null;
  }
  async create(): Promise<boolean> {
    return true;
  }
  async listByThread(): Promise<Trigger[]> {
    return [
      Trigger.create({
        id: 'trigger-1',
        dedupeKey: 'lark:1',
        sourceType: 'lark',
        instanceId: 'instance-1',
        threadId: 'thread-1',
        actorId: 'open-id-1',
        text: '需求正文',
        payload: {},
        occurredAt: LATER,
        receivedAt: LATER,
      }),
    ];
  }
  async listByIds(): Promise<Trigger[]> {
    return [];
  }
  async saveDisposition(): Promise<void> {}
}

class FakeDecisionRepository implements DecisionRepository {
  async findById(): Promise<Decision | null> {
    return null;
  }
  async listByThread(): Promise<Decision[]> {
    return [
      Decision.create({
        id: 'decision-1',
        threadId: 'thread-1',
        kind: 'accept',
        strength: 'explicit',
        scope: {},
        policyId: 'policy-1',
        policyVersion: 1,
        matchedRuleIds: ['rule-1'],
        reason: '信息完整',
        triggerIds: ['trigger-1'],
        now: AT,
      }),
    ];
  }
  async create(): Promise<void> {}
}

class FakeArtifactRepository implements ArtifactRepository {
  async findById(): Promise<Artifact | null> {
    return null;
  }
  async listByTicket(): Promise<Artifact[]> {
    return [
      Artifact.create({
        id: 'artifact-1',
        ticketId: 'ticket-1',
        kind: 'clarify',
        version: 1,
        payload: { secret: 'a', nested: { secret: 'b' } },
        now: LATER,
      }),
    ];
  }
  async findLatest(): Promise<Artifact | null> {
    return null;
  }
  async save(): Promise<void> {}
}

class FakeAssignmentRepository implements AssignmentRepository {
  async findById(): Promise<Assignment | null> {
    return null;
  }
  async listByTicket(): Promise<Assignment[]> {
    return [
      Assignment.create({
        id: 'assignment-1',
        ticketId: 'ticket-1',
        now: AT,
      }),
    ];
  }
  async findActiveByTicket(): Promise<Assignment | null> {
    return null;
  }
  async save(): Promise<void> {}
}

class FakeAttentionRepository implements AttentionRepository {
  async findById(): Promise<Attention | null> {
    return null;
  }
  async listOpenByTicket(): Promise<Attention[]> {
    return [];
  }
  async listOpen(): Promise<Attention[]> {
    return [];
  }
  async listByTicket(): Promise<Attention[]> {
    const attention = Attention.create({
      id: 'attention-1',
      ticketId: 'ticket-1',
      kind: 'clarify',
      question: '验收标准？',
      assignee: 'ou-owner',
      deadline: new Date(AT.getTime() + 2 * 3_600_000),
      now: AT,
    });
    attention.answerWith('按 PRD', 'user-1', LATER);
    return [attention];
  }
  async save(): Promise<void> {}
}

class FakePolicyRepository implements PolicyRepository {
  constructor(private readonly policy: Policy | null = null) {}
  async findById(): Promise<Policy | null> {
    return this.policy;
  }
  async findCurrent(): Promise<Policy | null> {
    return this.policy;
  }
  async findByVersion(): Promise<Policy | null> {
    return null;
  }
  async create(): Promise<void> {}
}

class FakeReportRepository implements ReportRepository {
  async findById(): Promise<Report | null> {
    return null;
  }
  async listByAssignment(): Promise<Report[]> {
    return [
      Report.create({
        id: 'report-1',
        assignmentId: 'assignment-1',
        kind: 'progress',
        payload: {},
        now: LATER,
      }),
    ];
  }
  async create(): Promise<void> {}
}

describe('TimelineService.forTicket', () => {
  it('合并事件并按时间排序', async () => {
    const service = new TimelineService(
      new EmptyTicketRepository(),
      new EmptyThreadRepository(),
      new FakeTriggerRepository(),
      new FakeDecisionRepository(),
      new FakeArtifactRepository(),
      new FakeAssignmentRepository(),
      new FakeAttentionRepository(),
      new FakeReportRepository(),
      new FakePolicyRepository(),
    );

    const timeline = await service.forTicket('ticket-1');

    const types = timeline?.events.map((event) => event.type) ?? [];
    expect(types).toContain('attention');
    expect(types).toContain('report');
    const times = timeline?.events.map((event) => event.at) ?? [];
    expect(times).toEqual([...times].sort());
    expect(timeline?.events[0].at).toBe(AT.toISOString());
    expect(timeline?.snapshot.status).toBe('open');
    expect(timeline?.snapshot.artifacts[0]).toMatchObject({
      kind: 'clarify',
      version: 1,
      status: 'draft',
    });
    expect(timeline?.snapshot.attentions[0].status).toBe('answered');
  });

  it('按策略递归脱敏回放字段', async () => {
    const policy = Policy.create({
      id: 'policy-1',
      version: 1,
      acceptMode: 'explicit',
      rules: { auditRedactFields: ['secret'] },
      createdBy: 'admin',
      now: AT,
    });
    const service = new TimelineService(
      new EmptyTicketRepository(),
      new EmptyThreadRepository(),
      new FakeTriggerRepository(),
      new FakeDecisionRepository(),
      new FakeArtifactRepository(),
      new FakeAssignmentRepository(),
      new FakeAttentionRepository(),
      new FakeReportRepository(),
      new FakePolicyRepository(policy),
    );

    const timeline = await service.forTicket('ticket-1');
    expect(timeline?.snapshot.artifacts[0].payload).toEqual({
      secret: '***',
      nested: { secret: '***' },
    });
  });

  it('按截止时间截断回放', async () => {
    const service = new TimelineService(
      new EmptyTicketRepository(),
      new EmptyThreadRepository(),
      new FakeTriggerRepository(),
      new FakeDecisionRepository(),
      new FakeArtifactRepository(),
      new FakeAssignmentRepository(),
      new FakeAttentionRepository(),
      new FakeReportRepository(),
      new FakePolicyRepository(),
    );

    const timeline = await service.forTicket('ticket-1', AT);
    expect(
      timeline?.events.every((event) => event.at <= AT.toISOString()),
    ).toBe(true);
  });
});
