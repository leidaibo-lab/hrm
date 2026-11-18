import { describe, expect, it } from 'vitest';
import type { SessionRepository } from '../../domain/session.repository';
import { SessionService } from '../session.service';

/** 内存会话仓储替身：记录委托调用并维护最小会话状态。 */
class FakeSessions implements SessionRepository {
  created: string[] = [];
  revoked: string[] = [];
  private readonly store = new Map<string, string>();

  async create(userId: string): Promise<string> {
    const sid = `sid-${this.created.length + 1}`;
    this.created.push(userId);
    this.store.set(sid, userId);
    return sid;
  }

  async resolve(sid: string): Promise<{ userId: string } | null> {
    const userId = this.store.get(sid);
    return userId ? { userId } : null;
  }

  async revoke(sid: string): Promise<void> {
    this.revoked.push(sid);
    this.store.delete(sid);
  }
}

describe('SessionService（薄编排经端口）', () => {
  it('create/resolve/revoke 全部委托端口', async () => {
    const fake = new FakeSessions();
    const service = new SessionService(fake);
    const sid = await service.create('u1');
    expect(fake.created).toEqual(['u1']);
    expect(await service.resolve(sid)).toEqual({ userId: 'u1' });
    await service.revoke(sid);
    expect(fake.revoked).toEqual([sid]);
    expect(await service.resolve(sid)).toBeNull();
  });
});
