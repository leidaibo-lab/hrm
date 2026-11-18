import type { Thread } from './thread.entity';

/** 线程仓储的 DI 令牌：application 依赖端口，infrastructure 提供实现。 */
export const THREAD_REPOSITORY = Symbol('THREAD_REPOSITORY');

/** 线程仓储端口：持久化实现由 infrastructure 提供。 */
export interface ThreadRepository {
  /** 按主键查找；不存在返回 null。 */
  findById(id: string): Promise<Thread | null>;
  /** 按来源与外部键查找；不存在返回 null。 */
  findByExternalKey(
    sourceType: string,
    externalKey: string,
  ): Promise<Thread | null>;
  /** 按最近事件倒序列出线程；scopeKeys 未设置表示不限制。 */
  list(limit?: number, scopeKeys?: string[]): Promise<Thread[]>;
  /** 保存聚合（新建或更新）。 */
  save(thread: Thread): Promise<void>;
}
