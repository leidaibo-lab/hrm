import type { SourceType } from './source-adapter.port';
import type { SourceInstance } from './source-instance.entity';

/** 来源实例仓储的 DI 令牌。 */
export const SOURCE_INSTANCE_REPOSITORY = Symbol('SOURCE_INSTANCE_REPOSITORY');

/** 来源实例仓储端口。 */
export interface SourceInstanceRepository {
  /** 按主键查找；不存在返回 null。 */
  findById(id: string): Promise<SourceInstance | null>;
  /** 按类型与名称查找；不存在返回 null。 */
  findByTypeAndName(
    sourceType: SourceType,
    name: string,
  ): Promise<SourceInstance | null>;
  /** 列出实例，按创建时间升序。 */
  list(limit?: number): Promise<SourceInstance[]>;
  /** 保存实例（新建或更新可变字段）。 */
  save(instance: SourceInstance): Promise<void>;
}
