/** 目录同步记录仓储注入令牌。 */
export const CATALOG_SYNC_REPOSITORY = Symbol('CATALOG_SYNC_REPOSITORY');

/** 目录同步状态：成功、失败、部分匹配。 */
export type CatalogSyncStatus = 'success' | 'failed' | 'partial';

/** 目录同步记录：只追加，失败不清旧数据。 */
export interface CatalogSyncRecord {
  /** 记录标识。 */
  id: string;
  /** 开始时间。 */
  startedAt: string;
  /** 结束时间。 */
  finishedAt: string | null;
  /** 状态。 */
  status: CatalogSyncStatus;
  /** 供应商数量。 */
  providers: number;
  /** 模型数量。 */
  models: number;
  /** 写入的价格数量。 */
  pricesWritten: number;
  /** 未匹配数量。 */
  unmatched: number;
  /** 错误信息。 */
  error: string | null;
  /** 创建时间。 */
  createdAt: string;
}

/** 同步记录新建输入。 */
export interface CatalogSyncCreateData {
  /** 开始时间。 */
  startedAt: Date;
  /** 结束时间。 */
  finishedAt: Date;
  /** 状态。 */
  status: CatalogSyncStatus;
  /** 供应商数量。 */
  providers: number;
  /** 模型数量。 */
  models: number;
  /** 写入的价格数量。 */
  pricesWritten: number;
  /** 未匹配数量。 */
  unmatched: number;
  /** 错误信息。 */
  error: string | null;
}

/** 目录同步记录仓储端口。 */
export interface CatalogSyncRepository {
  /** 创建记录并返回结果。 */
  create(data: CatalogSyncCreateData): Promise<CatalogSyncRecord>;
  /** 列出记录。 */
  list(limit: number): Promise<CatalogSyncRecord[]>;
}
