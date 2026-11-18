import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ScopeMembership } from '../domain/scope-membership.entity';
import {
  SCOPE_MEMBERSHIP_REPOSITORY,
  type ScopeMembershipRepository,
} from '../domain/scope-membership.repository';
import {
  TICKET_REPOSITORY,
  type TicketRepository,
} from '../domain/ticket.repository';

/** 调用方身份：只依赖权限与用户标识，避免 application 依赖 pipeline。 */
export interface ScopeActor {
  /** 平台用户标识。 */
  id: string;
  /** 权限点列表；`*` 表示平台管理员。 */
  permissions: readonly string[];
}

/**
 * 数据范围访问控制：用户可访问的项目/空间集合。
 * 平台管理员（`*`）不受限；其余用户按成员关系过滤。
 */
@Injectable()
export class ScopeAccessService {
  constructor(
    @Inject(SCOPE_MEMBERSHIP_REPOSITORY)
    private readonly memberships: ScopeMembershipRepository,
    @Inject(TICKET_REPOSITORY) private readonly tickets: TicketRepository,
  ) {}

  /** 返回可访问 scopeKey 列表；null 表示不受限。 */
  async allowedScopeKeys(actor: ScopeActor): Promise<string[] | null> {
    if (actor.permissions.includes('*')) return null;
    const rows = await this.memberships.listByUser(actor.id);
    return rows.map((row) => row.scopeKey);
  }

  /** 判断资源 scope 是否在允许集合内；null 集合表示不受限。 */
  isAllowed(scopeKey: string | null, allowed: string[] | null): boolean {
    if (allowed === null) return true;
    if (scopeKey === null) return true;
    return allowed.includes(scopeKey);
  }

  /** 判断用户能否访问某工单；工单不存在视为不可访问。 */
  async canAccessTicket(
    ticketId: string,
    allowed: string[] | null,
  ): Promise<boolean> {
    if (allowed === null) return true;
    const ticket = await this.tickets.findById(ticketId);
    if (!ticket) return false;
    return this.isAllowed(ticket.scopeKey, allowed);
  }

  /** 列出范围成员。 */
  async listMembers(scopeKey: string): Promise<ScopeMembership[]> {
    return this.memberships.listByScope(scopeKey);
  }

  /** 授权成员关系；已存在时幂等。 */
  async grant(input: {
    userId: string;
    scopeKey: string;
    now?: Date;
  }): Promise<ScopeMembership> {
    const membership = ScopeMembership.create({
      id: randomUUID(),
      userId: input.userId,
      scopeKey: input.scopeKey,
      now: input.now,
    });
    await this.memberships.save(membership);
    return membership;
  }

  /** 撤销成员关系；返回是否存在。 */
  async revoke(userId: string, scopeKey: string): Promise<boolean> {
    return this.memberships.remove(userId, scopeKey);
  }
}
