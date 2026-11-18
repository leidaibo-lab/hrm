import type { ScopeMembership } from './scope-membership.entity';

/** 数据范围成员仓储的 DI 令牌。 */
export const SCOPE_MEMBERSHIP_REPOSITORY = Symbol(
  'SCOPE_MEMBERSHIP_REPOSITORY',
);

/** 数据范围成员仓储端口。 */
export interface ScopeMembershipRepository {
  /** 列出用户全部成员关系。 */
  listByUser(userId: string): Promise<ScopeMembership[]>;
  /** 列出某 scope 的全部成员关系。 */
  listByScope(scopeKey: string): Promise<ScopeMembership[]>;
  /** 追加成员关系；重复关系由唯一约束拒绝。 */
  save(membership: ScopeMembership): Promise<void>;
  /** 删除成员关系；不存在返回 false。 */
  remove(userId: string, scopeKey: string): Promise<boolean>;
}
