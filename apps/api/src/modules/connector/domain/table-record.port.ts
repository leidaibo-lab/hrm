/** 表格记录读取端口的 DI 令牌。 */
export const TABLE_RECORD_READER = Symbol('TABLE_RECORD_READER');

/** 表格记录。 */
export interface TableRecord {
  /** app_token。 */
  appToken: string;
  /** table_id。 */
  tableId: string;
  /** record_id。 */
  recordId: string;
  /** 最近修改时间（毫秒）。 */
  lastModifiedTime: number;
  /** 字段值。 */
  fields: Record<string, unknown>;
}

/** 表格读取器：按游标拉取变更记录。 */
export interface TableRecordReader {
  /** 读取游标之后的记录。 */
  read(input: {
    /** 来源类型。 */
    sourceType: string;
    /** 源配置。 */
    config: unknown;
    /** 上次游标（毫秒）。 */
    since: number;
  }): Promise<TableRecord[]>;
}
