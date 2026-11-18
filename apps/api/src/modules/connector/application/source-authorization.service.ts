import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { SourceAuthorization } from '../domain/source-authorization.entity';
import {
  SOURCE_AUTHORIZATION_REPOSITORY,
  type SourceAuthorizationRepository,
} from '../domain/source-authorization.repository';

/**
 * 来源授权用例：群管理员授权、到期/撤销失效、接入时校验。
 * V0 迁移兼容：实例尚无任何授权记录时按旧配置白名单放行。
 */
@Injectable()
export class SourceAuthorizationService {
  constructor(
    @Inject(SOURCE_AUTHORIZATION_REPOSITORY)
    private readonly authorizations: SourceAuthorizationRepository,
  ) {}

  /** 是否允许该实例/范围的事件进入（授权记录存在时强制校验）。 */
  async isAuthorized(
    sourceInstanceId: string,
    scopeKey: string,
    now: Date = new Date(),
  ): Promise<boolean> {
    const authorization = await this.authorizations.findByInstanceAndScope(
      sourceInstanceId,
      scopeKey,
    );
    if (authorization) return authorization.isActive(now);
    const all = await this.authorizations.listByInstance(sourceInstanceId);
    // 迁移兼容：没有任何授权记录时沿用旧配置白名单。
    return all.length === 0;
  }

  /** 授权范围；已存在时更新有效期/授权人。 */
  async authorize(input: {
    sourceInstanceId: string;
    scopeKey: string;
    authorizedBy: string;
    expiresAt?: Date | null;
    now?: Date;
  }): Promise<SourceAuthorization> {
    const existing = await this.authorizations.findByInstanceAndScope(
      input.sourceInstanceId,
      input.scopeKey,
    );
    const authorization = existing
      ? SourceAuthorization.rehydrate({
          ...existing.toSnapshot(),
          authorizedBy: input.authorizedBy,
          expiresAt: input.expiresAt ?? null,
          revokedAt: null,
        })
      : SourceAuthorization.create({
          id: randomUUID(),
          sourceInstanceId: input.sourceInstanceId,
          scopeKey: input.scopeKey,
          authorizedBy: input.authorizedBy,
          expiresAt: input.expiresAt,
          now: input.now,
        });
    await this.authorizations.save(authorization);
    return authorization;
  }

  /** 撤销授权；不存在或已撤销返回 false。 */
  async revoke(
    sourceInstanceId: string,
    scopeKey: string,
    now: Date = new Date(),
  ): Promise<boolean> {
    const authorization = await this.authorizations.findByInstanceAndScope(
      sourceInstanceId,
      scopeKey,
    );
    if (!authorization || authorization.revokedAt) return false;
    authorization.revoke(now);
    await this.authorizations.save(authorization);
    return true;
  }

  /** 列出实例授权。 */
  async list(sourceInstanceId: string): Promise<SourceAuthorization[]> {
    return this.authorizations.listByInstance(sourceInstanceId);
  }
}
