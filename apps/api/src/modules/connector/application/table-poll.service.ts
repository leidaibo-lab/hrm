import { Inject, Injectable, Logger } from '@nestjs/common';
import { SourceCursor } from '../domain/source-cursor.entity';
import {
  SOURCE_CURSOR_REPOSITORY,
  type SourceCursorRepository,
} from '../domain/source-cursor.repository';
import {
  SOURCE_INSTANCE_REPOSITORY,
  type SourceInstanceRepository,
} from '../domain/source-instance.repository';
import {
  TABLE_RECORD_READER,
  type TableRecord,
  type TableRecordReader,
} from '../domain/table-record.port';
import { IngressService } from './ingress.service';
import { SourceHealthService } from './source-health.service';

/** 表格轮询：读取变更记录并合成事件入站。 */
@Injectable()
export class TablePollService {
  private readonly logger = new Logger(TablePollService.name);
  private readonly backoff = new Map<
    string,
    { failures: number; nextAt: number }
  >();

  constructor(
    @Inject(SOURCE_INSTANCE_REPOSITORY)
    private readonly sources: SourceInstanceRepository,
    @Inject(SOURCE_CURSOR_REPOSITORY)
    private readonly cursors: SourceCursorRepository,
    @Inject(TABLE_RECORD_READER)
    private readonly reader: TableRecordReader,
    private readonly ingress: IngressService,
    private readonly health: SourceHealthService,
  ) {}

  /** 轮询全部启用的飞书实例。 */
  async pollAll(now: Date = new Date()): Promise<number> {
    const instances = await this.sources.list(100);
    let accepted = 0;
    for (const instance of instances) {
      if (!instance.isEnabled || instance.sourceType !== 'lark') continue;
      accepted += await this.poll(instance.id, now);
    }
    return accepted;
  }

  /** 轮询单个实例，返回接收记录数。 */
  async poll(instanceId: string, now: Date = new Date()): Promise<number> {
    const instance = await this.sources.findById(instanceId);
    if (!instance?.isEnabled) return 0;

    const wait = this.backoff.get(instanceId);
    if (wait && now.getTime() < wait.nextAt) return 0;

    const cursor = await this.cursors.findByInstance(instanceId);
    const since = this.cursorValue(cursor?.cursor);
    let records: TableRecord[];
    try {
      records = await this.reader.read({
        sourceType: instance.sourceType,
        config: instance.config,
        since,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : '未知错误';
      this.logger.warn(`表格轮询失败：${detail}`);
      const failures = (this.backoff.get(instanceId)?.failures ?? 0) + 1;
      const delay = Math.min(60_000 * 2 ** (failures - 1), 15 * 60_000);
      this.backoff.set(instanceId, {
        failures,
        nextAt: now.getTime() + delay,
      });
      await this.health.mark(instanceId, 'table', 'error', detail, now);
      return 0;
    }
    this.backoff.delete(instanceId);
    if (records.length === 0) {
      await this.health.mark(instanceId, 'table', 'ready', null, now);
      return 0;
    }

    let accepted = 0;
    let next = since;
    let failedAt: number | null = null;
    for (const record of records) {
      const result = await this.ingress
        .accept({
          instanceId,
          raw: this.toRaw(record),
          now,
          deferRouting: true,
        })
        .catch(() => ({ accepted: false as const }));
      if (!result.accepted) {
        // 游标只推进到连续成功前缀：失败记录留在下一轮重试，避免丢事件。
        // 限流属于暂时状态：不把健康标成错误，下一轮继续重试。
        if ('reason' in result && result.reason === 'rate_limited') {
          failedAt = null;
          break;
        }
        failedAt = record.lastModifiedTime;
        break;
      }
      accepted += 1;
      next = Math.max(next, record.lastModifiedTime);
    }

    await this.health.mark(
      instanceId,
      'table',
      failedAt === null ? 'ready' : 'error',
      failedAt === null ? null : '存在未接收记录，等待下一轮重试',
      now,
    );
    await this.cursors.save(
      cursor
        ? SourceCursor.rehydrate({
            ...cursor.toSnapshot(),
            cursor: { lastModifiedTime: next },
            updatedAt: now,
          })
        : SourceCursor.create({
            instanceId,
            cursor: { lastModifiedTime: next },
            now,
          }),
    );
    return accepted;
  }

  private cursorValue(cursor: unknown): number {
    return typeof cursor === 'object' &&
      cursor !== null &&
      typeof (cursor as { lastModifiedTime?: unknown }).lastModifiedTime ===
        'number'
      ? (cursor as { lastModifiedTime: number }).lastModifiedTime
      : 0;
  }

  private toRaw(record: TableRecord): unknown {
    return {
      message_id: `bitable:${record.tableId}:${record.recordId}:${record.lastModifiedTime}`,
      chat_id: record.tableId,
      sender_id: 'bitable',
      text: JSON.stringify(record.fields),
      mentions_me: true,
      create_time: record.lastModifiedTime,
      app_token: record.appToken,
      table_id: record.tableId,
      record_id: record.recordId,
    };
  }
}
