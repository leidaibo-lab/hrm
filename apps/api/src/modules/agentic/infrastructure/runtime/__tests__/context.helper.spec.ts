import { describe, expect, it } from 'vitest';
import { Artifact } from '../../../domain/artifact.entity';
import type { ArtifactRepository } from '../../../domain/artifact.repository';
import { Attention } from '../../../domain/attention.entity';
import type { AttentionRepository } from '../../../domain/attention.repository';
import { Decision } from '../../../domain/decision.entity';
import type { DecisionRepository } from '../../../domain/decision.repository';
import { Policy } from '../../../domain/policy.entity';
import { Thread } from '../../../domain/thread.entity';
import type { ThreadRepository } from '../../../domain/thread.repository';
import { Trigger } from '../../../domain/trigger.entity';
import type { TriggerRepository } from '../../../domain/trigger.repository';
import { buildContextBundle } from '../context.helper';

const AT = new Date('2026-11-16T00:00:00.000Z');

function thread(): Thread {
  return Thread.rehydrate({
    id: 'thread-1',
    sourceType: 'lark',
    externalKey: 'chat:1',
    scopeKey: 'project-a',
    status: 'open',
    summary: '导出需求讨论',
    summaryVersion: 1,
    lastEventAt: AT,
    createdAt: AT,
    updatedAt: AT,
  });
}

function trigger(id: string): Trigger {
  return Trigger.create({
    id,
    dedupeKey: id,
    sourceType: 'lark',
    instanceId: 'instance-1',
    threadId: 'thread-1',
    actorId: 'actor-1',
    actorUserId: 'user-1',
    text: `事件 ${id}`,
    payload: {},
    occurredAt: AT,
  });
}

function decision(): Decision {
  return Decision.create({
    id: 'decision-1',
    threadId: 'thread-1',
    kind: 'accept',
    strength: 'explicit',
    scope: {},
    matchedRuleIds: ['rule-1'],
    policyId: 'policy-1',
    policyVersion: 1,
    reason: '信息完整',
    triggerIds: ['trigger-1'],
    now: AT,
  });
}

function artifact(): Artifact {
  return Artifact.create({
    id: 'artifact-1',
    ticketId: 'ticket-1',
    kind: 'clarify',
    version: 1,
    payload: { summary: '澄清摘要', draft: { goal: '导出' } },
    now: AT,
  });
}

function attention(): Attention {
  return Attention.create({
    id: 'attention-1',
    ticketId: 'ticket-1',
    kind: 'clarify',
    question: '导出字段范围？',
    deadline: new Date(AT.getTime() + 3_600_000),
    assignee: 'ou-owner',
    now: AT,
  });
}

function makeDeps(): {
  deps: {
    threads: ThreadRepository;
    triggers: TriggerRepository;
    artifacts: ArtifactRepository;
    decisions: DecisionRepository;
    attentions: AttentionRepository;
  };
} {
  const threads = {
    async findById() {
      return thread();
    },
    async findByExternalKey() {
      return null;
    },
    async list() {
      return [thread()];
    },
    async save() {},
  } satisfies ThreadRepository;
  const triggers = {
    async findByDedupeKey() {
      return null;
    },
    async create() {
      return true;
    },
    async listByThread() {
      return [trigger('trigger-1'), trigger('trigger-2')];
    },
    async listByIds() {
      return [];
    },
    async saveDisposition() {},
  } satisfies TriggerRepository;
  const artifacts = {
    async findById() {
      return null;
    },
    async listByTicket() {
      return [artifact()];
    },
    async findLatest() {
      return artifact();
    },
    async save() {},
  } satisfies ArtifactRepository;
  const decisions = {
    async findById() {
      return null;
    },
    async listByThread() {
      return [decision()];
    },
    async create() {},
  } satisfies DecisionRepository;
  const attentions = {
    async findById() {
      return null;
    },
    async listOpenByTicket() {
      return [attention()];
    },
    async listOpen() {
      return [];
    },
    async listByTicket() {
      return [];
    },
    async save() {},
  } satisfies AttentionRepository;
  return {
    deps: { threads, triggers, artifacts, decisions, attentions },
  };
}

function input(maxChars?: number) {
  return {
    threadId: 'thread-1',
    ticketId: 'ticket-1',
    triggers: [trigger('trigger-1')],
    policy: Policy.create({
      id: 'policy-1',
      version: 1,
      acceptMode: 'explicit',
      rules: { escalationOwner: 'ou-owner' },
      createdBy: 'admin',
      now: AT,
    }),
    ...(maxChars === undefined ? {} : { maxChars }),
  };
}

describe('context.helper', () => {
  it('装配线程、事件、结论、产物、关注与策略', async () => {
    const { deps } = makeDeps();
    const result = await buildContextBundle(deps, input());
    const bundle = result.bundle as {
      thread: { id: string };
      events: unknown[];
      decisions: unknown[];
      artifacts: unknown[];
      attentions: unknown[];
      policy: { version: number };
    };

    expect(bundle.thread.id).toBe('thread-1');
    expect(bundle.events).toHaveLength(2);
    expect(bundle.decisions).toHaveLength(1);
    expect(bundle.artifacts).toHaveLength(1);
    expect(bundle.attentions).toHaveLength(1);
    expect(bundle.policy.version).toBe(1);
    expect(result.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(result.truncated).toBe(false);
  });

  it('超出预算时裁剪并标记 truncated', async () => {
    const { deps } = makeDeps();
    const result = await buildContextBundle(deps, input(120));

    expect(result.truncated).toBe(true);
    const bundle = result.bundle as {
      events: unknown[];
      artifacts: Array<{ payload: unknown }>;
    };
    expect(bundle.events.length).toBeLessThanOrEqual(5);
    expect(bundle.artifacts[0]?.payload).toBeNull();
  });

  it('同一输入 digest 稳定', async () => {
    const { deps } = makeDeps();
    const first = await buildContextBundle(deps, input());
    const second = await buildContextBundle(deps, input());

    expect(first.digest).toBe(second.digest);
  });
});

describe('context.helper 冲突标记', () => {
  it('进行中工单遇到取消请求时写入 conflicts', async () => {
    const { deps } = makeDeps();
    const triggers = [trigger('trigger-cancel')];
    triggers[0] = (() => {
      const created = Trigger.create({
        id: 'trigger-cancel',
        dedupeKey: 'cancel',
        sourceType: 'lark',
        instanceId: 'instance-1',
        threadId: 'thread-1',
        actorId: 'actor-1',
        text: '这个需求取消吧',
        payload: {},
        occurredAt: AT,
      });
      return created;
    })();
    const result = await buildContextBundle(
      {
        ...deps,
        triggers: {
          ...deps.triggers,
          listByThread: async () => triggers,
        } as never,
      },
      { ...input(), ticketOpen: true },
    );
    const bundle = result.bundle as { conflicts: unknown[] };
    expect(bundle.conflicts).toHaveLength(1);
  });
});
