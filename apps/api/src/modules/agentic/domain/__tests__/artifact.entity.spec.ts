import { describe, expect, it } from 'vitest';
import { Artifact } from '../artifact.entity';

const AT = new Date('2026-11-16T00:00:00.000Z');

function createArtifact(): Artifact {
  return Artifact.create({
    id: 'artifact-1',
    ticketId: 'ticket-1',
    kind: 'clarify',
    version: 1,
    payload: { summary: '澄清稿' },
    now: AT,
  });
}

describe('Artifact 聚合', () => {
  it('创建后为草稿', () => {
    const artifact = createArtifact();
    expect(artifact.status).toBe('draft');
    expect(artifact.version).toBe(1);
  });

  it('版本必须为正整数', () => {
    expect(() =>
      Artifact.create({
        id: 'artifact-1',
        ticketId: 'ticket-1',
        kind: 'clarify',
        version: 0,
        payload: {},
      }),
    ).toThrow('产物版本必须为正整数');
  });

  it('负载不能为空', () => {
    expect(() =>
      Artifact.create({
        id: 'artifact-1',
        ticketId: 'ticket-1',
        kind: 'clarify',
        version: 1,
        payload: null,
      }),
    ).toThrow('产物负载不能为空');
  });

  it('确认后不能再被替代确认', () => {
    const artifact = createArtifact();
    artifact.confirm();
    expect(artifact.status).toBe('confirmed');
    artifact.supersede();
    expect(artifact.status).toBe('superseded');
    expect(() => artifact.confirm()).toThrow('已被替代的产物不能确认');
  });

  it('快照可重建等价聚合', () => {
    const artifact = createArtifact();
    artifact.confirm();
    const restored = Artifact.rehydrate(artifact.toSnapshot());
    expect(restored.toSnapshot()).toEqual(artifact.toSnapshot());
  });
});
