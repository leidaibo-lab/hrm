import type { SourceCursor } from './source-cursor.entity';

/** 来源游标仓储的 DI 令牌。 */
export const SOURCE_CURSOR_REPOSITORY = Symbol('SOURCE_CURSOR_REPOSITORY');

/** 来源游标仓储端口。 */
export interface SourceCursorRepository {
  /** 按实例查找；不存在返回 null。 */
  findByInstance(instanceId: string): Promise<SourceCursor | null>;
  /** 保存游标（新建或推进）。 */
  save(cursor: SourceCursor): Promise<void>;
}
