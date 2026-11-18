import { describe, expect, it } from 'vitest';
import type { SourceCursor } from '../../domain/source-cursor.entity';
import type { SourceCursorRepository } from '../../domain/source-cursor.repository';
import { SourceInstance } from '../../domain/source-instance.entity';
import type { SourceInstanceRepository } from '../../domain/source-instance.repository';
import type {
  TableRecord,
  TableRecordReader,
} from '../../domain/table-record.port';
import type { IngressService } from '../ingress.service';
import type { SourceHealthService } from '../source-health.service';
import { TablePollService } from '../table-poll.service';

const AT = new Date('2026-11-16T00:00:00.000Z');

class FakeSourceRepository implements SourceInstanceRepository {
  constructor(private readonly instance: SourceInstance | null) {}
  async findById(): Promise<SourceInstance | null> {
    return this.instance;
  }
  async findByTypeAndName(): Promise<SourceInstance | null> {
    return null;
  }
  async list(): Promise<SourceInstance[]> {
    return this.instance ? [this.instance] : [];
  }
  async save(): Promise<void> {}
}

class FakeCursorRepository implements SourceCursorRepository {
  saved: SourceCursor | null = null;
  async findByInstance(): Promise<SourceCursor | null> {
    return null;
  }
  async save(cursor: SourceCursor): Promise<void> {
    this.saved = cursor;
  }
}

class FakeReader implements TableRecordReader {
  async read(): Promise<TableRecord[]> {
    return [
      {
        appToken: 'app',
        tableId: 'table',
        recordId: 'record-1',
        lastModifiedTime: 100,
        fields: { 标题: '导出' },
      },
      {
        appToken: 'app',
        tableId: 'table',
        recordId: 'record-2',
        lastModifiedTime: 200,
        fields: { 标题: '导入' },
      },
    ];
  }
}

class FakeHealth {
  readonly marks: Array<{ entry: string; state: string }> = [];
  async mark(_instanceId: string, entry: string, state: string): Promise<void> {
    this.marks.push({ entry, state });
  }
}

class FailingReader implements TableRecordReader {
  calls = 0;
  async read(): Promise<TableRecord[]> {
    this.calls += 1;
    throw new Error('飞书 500');
  }
}

class FakeIngress {
  readonly raws: unknown[] = [];
  async accept(input: { raw: unknown }): Promise<{ accepted: true }> {
    this.raws.push(input.raw);
    return { accepted: true };
  }
}

class PartiallyFailingIngress {
  readonly raws: unknown[] = [];
  async accept(input: { raw: unknown }): Promise<{ accepted: boolean }> {
    this.raws.push(input.raw);
    return { accepted: this.raws.length === 1 };
  }
}

function makeInstance(): SourceInstance {
  return SourceInstance.create({
    id: 'instance-1',
    sourceType: 'lark',
    name: '需求表',
    config: { tables: [{ appToken: 'app', tableId: 'table' }] },
    now: AT,
  });
}

describe('TablePollService', () => {
  it('把变更记录合成事件并推进游标', async () => {
    const cursors = new FakeCursorRepository();
    const ingress = new FakeIngress();
    const service = new TablePollService(
      new FakeSourceRepository(makeInstance()),
      cursors,
      new FakeReader(),
      ingress as unknown as IngressService,
      new FakeHealth() as unknown as SourceHealthService,
    );

    const accepted = await service.poll('instance-1', AT);

    expect(accepted).toBe(2);
    expect(ingress.raws).toHaveLength(2);
    expect(cursors.saved?.cursor).toEqual({ lastModifiedTime: 200 });
  });

  it('接收失败时游标只推进到连续成功前缀，下一轮可重试', async () => {
    const cursors = new FakeCursorRepository();
    const ingress = new PartiallyFailingIngress();
    const health = new FakeHealth();
    const service = new TablePollService(
      new FakeSourceRepository(makeInstance()),
      cursors,
      new FakeReader(),
      ingress as unknown as IngressService,
      health as unknown as SourceHealthService,
    );

    expect(await service.poll('instance-1', AT)).toBe(1);
    expect(cursors.saved?.cursor).toEqual({ lastModifiedTime: 100 });
    expect(health.marks.some((mark) => mark.state === 'error')).toBe(true);
  });

  it('读取失败写入健康异常', async () => {
    const health = new FakeHealth();
    const service = new TablePollService(
      new FakeSourceRepository(makeInstance()),
      new FakeCursorRepository(),
      new FailingReader(),
      new FakeIngress() as unknown as IngressService,
      health as unknown as SourceHealthService,
    );

    expect(await service.poll('instance-1', AT)).toBe(0);
    expect(health.marks).toEqual([{ entry: 'table', state: 'error' }]);
  });

  it('失败后退避，窗口内不再请求', async () => {
    const reader = new FailingReader();
    const service = new TablePollService(
      new FakeSourceRepository(makeInstance()),
      new FakeCursorRepository(),
      reader,
      new FakeIngress() as unknown as IngressService,
      new FakeHealth() as unknown as SourceHealthService,
    );

    await service.poll('instance-1', AT);
    await service.poll('instance-1', new Date(AT.getTime() + 1_000));
    expect(reader.calls).toBe(1);

    await service.poll('instance-1', new Date(AT.getTime() + 61_000));
    expect(reader.calls).toBe(2);
  });

  it('停用实例不轮询', async () => {
    const instance = makeInstance();
    instance.disable(AT);
    const service = new TablePollService(
      new FakeSourceRepository(instance),
      new FakeCursorRepository(),
      new FakeReader(),
      new FakeIngress() as unknown as IngressService,
      new FakeHealth() as unknown as SourceHealthService,
    );
    expect(await service.poll('instance-1', AT)).toBe(0);
  });
});
