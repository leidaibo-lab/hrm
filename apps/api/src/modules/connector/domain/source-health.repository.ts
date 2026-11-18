import type { SourceHealth } from './source-health.entity';

/** 源健康仓储的 DI 令牌。 */
export const SOURCE_HEALTH_REPOSITORY = Symbol('SOURCE_HEALTH_REPOSITORY');

/** 源健康仓储端口。 */
export interface SourceHealthRepository {
  /** 按实例与条目查找；不存在返回 null。 */
  find(instanceId: string, entry: string): Promise<SourceHealth | null>;
  /** 列出实例的全部健康条目。 */
  listByInstance(instanceId: string): Promise<SourceHealth[]>;
  /** 保存健康记录（按实例 + 条目 upsert）。 */
  save(health: SourceHealth): Promise<void>;
}
