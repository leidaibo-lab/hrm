import { describe, expect, it } from 'vitest';
import type { AuditRecord } from '../../domain/audit-record.entity';
import { toTraceReplay } from '../audit-record-view.service';

const AT = new Date('2026-11-16T00:00:00.000Z');

function record(input: Partial<AuditRecord>): AuditRecord {
  return {
    id: input.id ?? 'audit-1',
    traceId: input.traceId ?? 'trace-1',
    actorId: input.actorId ?? null,
    action: input.action ?? 'agentic.run',
    method: input.method ?? 'WORKER',
    path: input.path ?? 'clarify',
    statusCode: input.statusCode ?? 200,
    detail: input.detail ?? {},
    createdAt: input.createdAt ?? AT,
  };
}

describe('toTraceReplay', () => {
  it('聚合运行、步骤、产物与授权依据', () => {
    const replay = toTraceReplay('trace-1', [
      record({
        id: 'run-1',
        detail: {
          ticketId: 'ticket-1',
          scopeKey: 'project-a',
          role: 'clarify',
          mandateId: 'mandate-1',
          policyVersion: 3,
          triggerIds: ['trigger-1'],
          steps: ['read-ticket', 'read-document'],
          durationMs: 1200,
          tokens: 800,
          artifactId: 'artifact-1',
          artifactKind: 'clarify',
          artifactVersion: 1,
        },
      }),
      record({
        id: 'run-2',
        action: 'internal.run.start',
        method: 'INTERNAL',
        path: 'runs',
        detail: {
          ticketId: 'ticket-1',
          mandateId: 'mandate-1',
          assignmentId: 'assignment-1',
        },
      }),
      record({
        id: 'artifact-1',
        action: 'internal.artifact.write',
        method: 'INTERNAL',
        path: 'artifacts',
        detail: {
          ticketId: 'ticket-1',
          artifactId: 'artifact-2',
          kind: 'report',
          version: 1,
        },
      }),
      record({
        id: 'other',
        action: 'artifact.restore',
        method: 'POST',
        path: '/tickets/ticket-1/artifacts/restore',
        detail: { ticketId: 'ticket-1' },
      }),
    ]);

    expect(replay.runs.map((run) => run.id)).toEqual(['run-1', 'run-2']);
    expect(replay.runs[0].steps).toEqual(['read-ticket', 'read-document']);
    expect(replay.runs[0].tokens).toBe(800);
    expect(replay.steps).toEqual(['read-ticket', 'read-document']);
    expect(replay.artifacts).toEqual([
      {
        artifactId: 'artifact-2',
        ticketId: 'ticket-1',
        kind: 'report',
        version: 1,
      },
      { artifactId: 'artifact-1', kind: 'clarify', version: 1 },
    ]);
    expect(replay.basis).toEqual({
      mandateId: 'mandate-1',
      policyVersion: 3,
      triggerIds: ['trigger-1'],
    });
    expect(replay.items).toHaveLength(4);
  });

  it('只有一条运行记录时也返回可判定的空集合', () => {
    const replay = toTraceReplay('trace-2', [
      record({ id: 'run-1', traceId: 'trace-2', detail: { role: 'clarify' } }),
    ]);

    expect(replay.runs).toHaveLength(1);
    expect(replay.steps).toEqual([]);
    expect(replay.artifacts).toEqual([]);
    expect(replay.basis).toEqual({});
  });
});
