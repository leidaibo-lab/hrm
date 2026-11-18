import type { SourceAuthorization } from './source-authorization.entity';

/** 来源授权仓储的 DI 令牌。 */
export const SOURCE_AUTHORIZATION_REPOSITORY = Symbol(
  'SOURCE_AUTHORIZATION_REPOSITORY',
);

/** 来源授权仓储端口。 */
export interface SourceAuthorizationRepository {
  /** 按来源实例与范围查找。 */
  findByInstanceAndScope(
    sourceInstanceId: string,
    scopeKey: string,
  ): Promise<SourceAuthorization | null>;
  /** 列出实例的全部授权。 */
  listByInstance(sourceInstanceId: string): Promise<SourceAuthorization[]>;
  /** 保存（新建或更新撤销状态）。 */
  save(authorization: SourceAuthorization): Promise<void>;
}
