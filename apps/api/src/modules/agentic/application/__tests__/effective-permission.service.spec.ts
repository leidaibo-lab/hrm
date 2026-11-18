import { PERMISSION } from '@cip/shared';
import { describe, expect, it } from 'vitest';
import {
  EffectivePermissionService,
  requiredPermissionFor,
} from '../effective-permission.service';

describe('EffectivePermissionService', () => {
  it('写产物动作要求 artifact:write 权限点', () => {
    expect(requiredPermissionFor('artifacts:write')).toBe(
      PERMISSION.artifact.write.code,
    );
    expect(requiredPermissionFor('runs:start')).toBe('agentic:internal');
  });

  it('内部令牌在范围内允许写产物', () => {
    const service = new EffectivePermissionService();
    expect(service.checkInternal('artifacts:write', 'project-a')).toEqual({
      allowed: true,
      reasons: [],
    });
  });

  it('内部令牌在范围内允许启动运行与回报', () => {
    const service = new EffectivePermissionService();
    expect(service.checkInternal('runs:start', 'project-a').allowed).toBe(true);
    expect(service.checkInternal('reports:append', 'project-a').allowed).toBe(
      true,
    );
  });
});
