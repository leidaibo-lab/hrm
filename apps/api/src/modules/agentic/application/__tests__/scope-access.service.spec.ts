import { describe, expect, it } from 'vitest';
import { ScopeMembership } from '../../domain/scope-membership.entity';
import type { ScopeMembershipRepository } from '../../domain/scope-membership.repository';
import type { Ticket } from '../../domain/ticket.entity';
import type { TicketRepository } from '../../domain/ticket.repository';
import { ScopeAccessService } from '../scope-access.service';

const AT = new Date('2026-11-16T00:00:00.000Z');

class FakeScopeMembershipRepository implements ScopeMembershipRepository {
  readonly rows: ScopeMembership[] = [];
  async listByUser(userId: string): Promise<ScopeMembership[]> {
    return this.rows.filter((row) => row.userId === userId);
  }
  async listByScope(scopeKey: string): Promise<ScopeMembership[]> {
    return this.rows.filter((row) => row.scopeKey === scopeKey);
  }
  async save(membership: ScopeMembership): Promise<void> {
    this.rows.push(membership);
  }
  async remove(userId: string, scopeKey: string): Promise<boolean> {
    const index = this.rows.findIndex(
      (row) => row.userId === userId && row.scopeKey === scopeKey,
    );
    if (index < 0) return false;
    this.rows.splice(index, 1);
    return true;
  }
}

function makeService(
  repository: FakeScopeMembershipRepository,
  ticketScope: string | null = 'project-a',
): ScopeAccessService {
  return new ScopeAccessService(repository, {
    findById: async () => ({ scopeKey: ticketScope }) as Ticket,
  } as unknown as TicketRepository);
}

describe('ScopeAccessService', () => {
  it('平台管理员不受 scope 限制', async () => {
    const service = makeService(new FakeScopeMembershipRepository());
    await expect(
      service.allowedScopeKeys({ id: 'u1', permissions: ['*'] }),
    ).resolves.toBeNull();
  });

  it('普通用户返回成员关系中的 scope 列表', async () => {
    const repository = new FakeScopeMembershipRepository();
    repository.rows.push(
      ScopeMembership.create({
        id: 'm1',
        userId: 'u1',
        scopeKey: 'project-a',
        now: AT,
      }),
      ScopeMembership.create({
        id: 'm2',
        userId: 'u1',
        scopeKey: 'project-b',
        now: AT,
      }),
    );
    const service = makeService(repository);

    await expect(
      service.allowedScopeKeys({ id: 'u1', permissions: ['ticket:read'] }),
    ).resolves.toEqual(['project-a', 'project-b']);
  });

  it('scope 判断：无限制放行、null scope 放行、越界拒绝', () => {
    const service = makeService(new FakeScopeMembershipRepository());
    expect(service.isAllowed('project-a', null)).toBe(true);
    expect(service.isAllowed(null, ['project-a'])).toBe(true);
    expect(service.isAllowed('project-a', ['project-a'])).toBe(true);
    expect(service.isAllowed('project-b', ['project-a'])).toBe(false);
  });

  it('按工单所属 scope 判断访问权', async () => {
    const service = makeService(
      new FakeScopeMembershipRepository(),
      'project-b',
    );
    expect(await service.canAccessTicket('ticket-1', ['project-a'])).toBe(
      false,
    );
    expect(await service.canAccessTicket('ticket-1', null)).toBe(true);
  });

  it('列出范围成员', async () => {
    const repository = new FakeScopeMembershipRepository();
    repository.rows.push(
      ScopeMembership.create({
        id: 'm1',
        userId: 'u1',
        scopeKey: 'project-a',
        now: AT,
      }),
    );
    const service = makeService(repository);
    await expect(service.listMembers('project-a')).resolves.toHaveLength(1);
  });

  it('授权与撤销成员关系', async () => {
    const repository = new FakeScopeMembershipRepository();
    const service = makeService(repository);

    await service.grant({ userId: 'u1', scopeKey: 'project-a', now: AT });
    expect(await service.revoke('u1', 'project-a')).toBe(true);
    expect(await service.revoke('u1', 'project-a')).toBe(false);
  });
});
