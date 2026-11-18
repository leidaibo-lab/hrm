import { describe, expect, it } from 'vitest';
import type { Artifact, ArtifactKind } from '../../domain/artifact.entity';
import type { ArtifactRepository } from '../../domain/artifact.repository';
import { ArtifactService } from '../artifact.service';

const AT = new Date('2026-11-16T00:00:00.000Z');

class FakeArtifactRepository implements ArtifactRepository {
  readonly rows = new Map<string, Artifact>();

  async findById(id: string): Promise<Artifact | null> {
    return this.rows.get(id) ?? null;
  }
  async listByTicket(ticketId: string): Promise<Artifact[]> {
    return [...this.rows.values()].filter(
      (artifact) => artifact.ticketId === ticketId,
    );
  }
  async findLatest(
    ticketId: string,
    kind: ArtifactKind,
  ): Promise<Artifact | null> {
    const matches = [...this.rows.values()].filter(
      (artifact) => artifact.ticketId === ticketId && artifact.kind === kind,
    );
    return (
      matches.sort((left, right) => right.version - left.version)[0] ?? null
    );
  }
  async save(artifact: Artifact): Promise<void> {
    this.rows.set(artifact.id, artifact);
  }
}

function makeService(): {
  service: ArtifactService;
  repository: FakeArtifactRepository;
} {
  const repository = new FakeArtifactRepository();
  return { service: new ArtifactService(repository), repository };
}

describe('ArtifactService', () => {
  it('同一工单同一类型版本递增', async () => {
    const { service } = makeService();
    const first = await service.publish({
      ticketId: 'ticket-1',
      kind: 'breakdown',
      payload: { tasks: 1 },
      now: AT,
    });
    const second = await service.publish({
      ticketId: 'ticket-1',
      kind: 'breakdown',
      payload: { tasks: 2 },
      now: AT,
    });

    expect(first.version).toBe(1);
    expect(second.version).toBe(2);
  });

  it('回滚到上一版本并废弃当前版本', async () => {
    const { service } = makeService();
    const first = await service.publish({
      ticketId: 'ticket-1',
      kind: 'clarify',
      payload: { value: 1 },
      now: AT,
    });
    const second = await service.publish({
      ticketId: 'ticket-1',
      kind: 'clarify',
      payload: { value: 2 },
      now: AT,
    });

    const restored = await service.restoreLatest('ticket-1', 'clarify', AT);

    expect(restored.version).toBe(3);
    expect(restored.payload).toEqual({ value: 1 });
    expect(first.status).toBe('draft');
    expect(second.status).toBe('superseded');
  });

  it('确认产物', async () => {
    const { service } = makeService();
    const artifact = await service.publish({
      ticketId: 'ticket-1',
      kind: 'analysis',
      payload: {},
      now: AT,
    });
    const confirmed = await service.confirm(artifact.id);
    expect(confirmed.status).toBe('confirmed');
  });

  it('产物不存在时报错', async () => {
    const { service } = makeService();
    await expect(service.confirm('missing')).rejects.toThrow('产物不存在');
  });
});
