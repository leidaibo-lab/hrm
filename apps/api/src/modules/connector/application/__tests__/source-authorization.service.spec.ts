import { describe, expect, it } from 'vitest';
import { SourceAuthorization } from '../../domain/source-authorization.entity';
import type { SourceAuthorizationRepository } from '../../domain/source-authorization.repository';
import { SourceAuthorizationService } from '../source-authorization.service';

const AT = new Date('2026-11-16T00:00:00.000Z');

class FakeRepository implements SourceAuthorizationRepository {
  readonly rows = new Map<string, SourceAuthorization>();
  private key(instanceId: string, scopeKey: string): string {
    return `${instanceId}:${scopeKey}`;
  }
  async findByInstanceAndScope(
    instanceId: string,
    scopeKey: string,
  ): Promise<SourceAuthorization | null> {
    return this.rows.get(this.key(instanceId, scopeKey)) ?? null;
  }
  async listByInstance(instanceId: string): Promise<SourceAuthorization[]> {
    return [...this.rows.values()].filter(
      (row) => row.sourceInstanceId === instanceId,
    );
  }
  async save(row: SourceAuthorization): Promise<void> {
    this.rows.set(this.key(row.sourceInstanceId, row.scopeKey), row);
  }
}

function makeService(): {
  service: SourceAuthorizationService;
  repository: FakeRepository;
} {
  const repository = new FakeRepository();
  return { service: new SourceAuthorizationService(repository), repository };
}

describe('SourceAuthorizationService', () => {
  it('无授权记录时兼容旧配置放行', async () => {
    const { service } = makeService();
    await expect(
      service.isAuthorized('instance-1', 'chat-1', AT),
    ).resolves.toBe(true);
  });

  it('授权后校验有效，过期/撤销失效', async () => {
    const { service } = makeService();
    await service.authorize({
      sourceInstanceId: 'instance-1',
      scopeKey: 'chat-1',
      authorizedBy: 'admin',
      now: AT,
    });
    await expect(
      service.isAuthorized('instance-1', 'chat-1', AT),
    ).resolves.toBe(true);
    await expect(
      service.isAuthorized('instance-1', 'chat-2', AT),
    ).resolves.toBe(false);

    await service.revoke('instance-1', 'chat-1', AT);
    await expect(
      service.isAuthorized('instance-1', 'chat-1', AT),
    ).resolves.toBe(false);
  });

  it('有效期到期后失效', async () => {
    const { service } = makeService();
    await service.authorize({
      sourceInstanceId: 'instance-1',
      scopeKey: 'chat-1',
      authorizedBy: 'admin',
      expiresAt: new Date(AT.getTime() + 3_600_000),
      now: AT,
    });
    await expect(
      service.isAuthorized(
        'instance-1',
        'chat-1',
        new Date(AT.getTime() + 7_200_000),
      ),
    ).resolves.toBe(false);
  });
});
