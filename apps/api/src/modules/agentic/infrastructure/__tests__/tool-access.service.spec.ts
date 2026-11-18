import { describe, expect, it } from 'vitest';
import type { ActorPermissionPort } from '../../domain/actor-permission.port';
import { ToolAccessService } from '../tool-access.service';

function makeService(permissions: string[] | null): ToolAccessService {
  const actor: ActorPermissionPort = {
    permissionsOf: async () => permissions,
  };
  return new ToolAccessService(actor);
}

const base = {
  actorUserId: 'user-1',
  role: 'clarify',
  tool: 'read-ticket',
  scopeKey: 'project-a',
};

describe('ToolAccessService', () => {
  it('角色白名单 + 触发人权限点同时满足才放行', async () => {
    await expect(makeService(['ticket:read']).authorize(base)).resolves.toBe(
      true,
    );
    await expect(makeService(['*']).authorize(base)).resolves.toBe(true);
  });

  it('缺权限点、未知用户、角色未声明工具时拒绝', async () => {
    await expect(makeService(['ticket:update']).authorize(base)).resolves.toBe(
      false,
    );
    await expect(makeService(null).authorize(base)).resolves.toBe(false);
    await expect(
      makeService(['ticket:read']).authorize({
        ...base,
        role: 'watchdog',
        tool: 'read-document',
      }),
    ).resolves.toBe(false);
    await expect(
      makeService(['ticket:read']).authorize({
        ...base,
        actorUserId: null,
      }),
    ).resolves.toBe(false);
  });
});
