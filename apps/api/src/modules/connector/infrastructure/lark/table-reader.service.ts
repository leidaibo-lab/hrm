import { Injectable } from '@nestjs/common';
import { env } from '../../../../config/env';
import { HttpService } from '../../../../platform/http';
import type {
  TableRecord,
  TableRecordReader,
} from '../../domain/table-record.port';
import { LarkTokenService } from './token.service';

/** 表格页大小。 */
const PAGE_SIZE = 100;
/** 单次轮询最大页数，防止失控拉取。 */
const MAX_PAGES = 10;

/** 表格配置条目。 */
interface TableConfig {
  /** app_token。 */
  appToken: string;
  /** table_id。 */
  tableId: string;
}

/** 记录响应。 */
interface RecordResponse {
  data?: {
    items?: Array<{
      record_id?: string;
      fields?: Record<string, unknown>;
      last_modified_time?: number;
    }>;
    has_more?: boolean;
    page_token?: string;
  };
}

/** 飞书多维表格读取器：按记录修改时间过滤。 */
@Injectable()
export class LarkTableReader implements TableRecordReader {
  constructor(
    private readonly http: HttpService,
    private readonly tokens: LarkTokenService,
  ) {}

  /** 读取游标之后的记录。 */
  async read(input: {
    sourceType: string;
    config: unknown;
    since: number;
  }): Promise<TableRecord[]> {
    if (input.sourceType !== 'lark') return [];
    const tables = this.tables(input.config);
    if (tables.length === 0) return [];

    const token = await this.tokens.getToken();
    const records: TableRecord[] = [];
    for (const table of tables) {
      let pageToken: string | undefined;
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const query = new URLSearchParams({
          page_size: String(PAGE_SIZE),
        });
        if (pageToken) query.set('page_token', pageToken);
        const response = await this.http.getJson<RecordResponse>(
          `${env.LARK_API_BASE}/open-apis/bitable/v1/apps/${encodeURIComponent(
            table.appToken,
          )}/tables/${encodeURIComponent(table.tableId)}/records?${query.toString()}`,
          { headers: { authorization: `Bearer ${token}` } },
        );
        for (const item of response.data?.items ?? []) {
          if (!item.record_id || !item.last_modified_time) continue;
          if (item.last_modified_time <= input.since) continue;
          records.push({
            appToken: table.appToken,
            tableId: table.tableId,
            recordId: item.record_id,
            lastModifiedTime: item.last_modified_time,
            fields: item.fields ?? {},
          });
        }
        if (!response.data?.has_more || !response.data.page_token) break;
        pageToken = response.data.page_token;
      }
    }
    return records;
  }

  private tables(config: unknown): TableConfig[] {
    if (!config || typeof config !== 'object') return [];
    const tables = (config as { tables?: unknown }).tables;
    if (!Array.isArray(tables)) return [];
    return tables.filter(
      (table): table is TableConfig =>
        typeof table === 'object' &&
        table !== null &&
        typeof (table as TableConfig).appToken === 'string' &&
        typeof (table as TableConfig).tableId === 'string',
    );
  }
}
