import { describe, expect, it } from 'vitest';
import { isAllowed } from '../effective-permission.entity';

const AT = new Date('2026-11-16T00:00:00.000Z');

function base() {
  return {
    capability: 'runs:start',
    capabilities: ['runs:start', 'reports:append'],
    requiredPermission: 'agentic:internal',
    actorPermissions: ['agentic:internal'],
    resourceScope: 'project-a',
    allowedScopes: null,
    now: AT,
  } as const;
}

describe('checkEffectivePermission', () => {
  it('四条件均满足时放行', () => {
    expect(isAllowed(base())).toEqual({
      allowed: true,
      reasons: [],
    });
  });

  it('能力、权限、范围、时间窗任一不满足即拒绝', () => {
    expect(
      isAllowed({
        ...base(),
        capability: 'artifacts:write',
      }).reasons,
    ).toContain('capability_denied');
    expect(isAllowed({ ...base(), actorPermissions: [] }).reasons).toContain(
      'permission_denied',
    );
    expect(
      isAllowed({
        ...base(),
        allowedScopes: ['project-b'],
      }).reasons,
    ).toContain('scope_denied');
    expect(
      isAllowed({
        ...base(),
        window: { from: new Date(AT.getTime() + 1_000) },
      }).reasons,
    ).toContain('window_not_started');
    expect(
      isAllowed({
        ...base(),
        window: { to: new Date(AT.getTime() - 1_000) },
      }).reasons,
    ).toContain('window_expired');
  });

  it('全量权限与不限范围通过', () => {
    expect(
      isAllowed({
        ...base(),
        actorPermissions: ['*'],
        allowedScopes: null,
      }).allowed,
    ).toBe(true);
  });
});
