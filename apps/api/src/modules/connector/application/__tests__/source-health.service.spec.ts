import { describe, expect, it } from 'vitest';
import type { SourceHealth } from '../../domain/source-health.entity';
import { SourceHealth as SourceHealthAggregate } from '../../domain/source-health.entity';
import type { SourceHealthRepository } from '../../domain/source-health.repository';
import { SourceHealthService } from '../source-health.service';

const AT = new Date('2026-11-16T00:00:00.000Z');
const LATER = new Date('2026-11-16T01:00:00.000Z');

class FakeSourceHealthRepository implements SourceHealthRepository {
  constructor(readonly rows: SourceHealth[]) {}
  async find(instanceId: string, entry: string): Promise<SourceHealth | null> {
    return (
      this.rows.find(
        (row) => row.instanceId === instanceId && row.entry === entry,
      ) ?? null
    );
  }
  async listByInstance(): Promise<SourceHealth[]> {
    return this.rows;
  }
  async save(health: SourceHealth): Promise<void> {
    const index = this.rows.findIndex(
      (row) =>
        row.instanceId === health.instanceId && row.entry === health.entry,
    );
    if (index >= 0) this.rows[index] = health;
    else this.rows.push(health);
  }
}

function makeHealth(): SourceHealth {
  return SourceHealthAggregate.create({
    instanceId: 'instance-1',
    entry: 'lark:connection',
    state: 'starting',
    now: AT,
  });
}

describe('SourceHealth 聚合', () => {
  it('状态更新记录详情与时间', () => {
    const health = makeHealth();
    health.mark('error', '连接失败', LATER);
    expect(health.state).toBe('error');
    expect(health.detail).toBe('连接失败');
    expect(health.checkedAt).toEqual(LATER);
  });

  it('条目不能为空', () => {
    expect(() =>
      SourceHealthAggregate.create({
        instanceId: 'instance-1',
        entry: '  ',
        state: 'starting',
      }),
    ).toThrow('健康条目不能为空');
  });
});

describe('SourceHealthService', () => {
  it('写入新条目并更新已有条目', async () => {
    const repository = new FakeSourceHealthRepository([]);
    const service = new SourceHealthService(repository);

    await service.mark('instance-1', 'ingress', 'ready', null, AT);
    await service.mark('instance-1', 'ingress', 'error', '解析失败', LATER);

    expect(repository.rows).toHaveLength(1);
    expect(repository.rows[0].state).toBe('error');
    expect(repository.rows[0].detail).toBe('解析失败');
  });

  it('按实例返回健康条目', async () => {
    const health = makeHealth();
    const service = new SourceHealthService(
      new FakeSourceHealthRepository([health]),
    );
    const items = await service.list('instance-1');
    expect(items).toHaveLength(1);
    expect(items[0].entry).toBe('lark:connection');
  });
});
