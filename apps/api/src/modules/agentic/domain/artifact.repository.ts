import type { Artifact, ArtifactKind } from './artifact.entity';

/** 产物仓储的 DI 令牌。 */
export const ARTIFACT_REPOSITORY = Symbol('ARTIFACT_REPOSITORY');

/** 产物仓储端口：按工单与类型维护版本链。 */
export interface ArtifactRepository {
  /** 按主键查找；不存在返回 null。 */
  findById(id: string): Promise<Artifact | null>;
  /** 列出工单的全部产物，按创建时间升序。 */
  listByTicket(ticketId: string): Promise<Artifact[]>;
  /** 取某工单某类型的最新版本；不存在返回 null。 */
  findLatest(ticketId: string, kind: ArtifactKind): Promise<Artifact | null>;
  /** 保存产物（新建或更新状态）。 */
  save(artifact: Artifact): Promise<void>;
}
