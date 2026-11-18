import { NAVIGATION_CATALOG, PERMISSION_CATALOG } from '@cip/shared';
import { Logger } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  NavigationNodeRepository,
  NavigationNodeRow,
} from '../../domain/navigation-node.repository';
import type { PermissionPointRow } from '../../domain/permission-point.repository';
import { SyncService } from '../sync.service';
import { FakePermissionPointRepository } from './fixtures/fake-repositories.fixture';

/** 内存导航投影（同步服务只用 findAll / create / activate / deprecate）。 */
class FakeNavigationNodeRepository implements NavigationNodeRepository {
  readonly rows: NavigationNodeRow[] = [];

  async findAll(): Promise<NavigationNodeRow[]> {
    return this.rows.map((row) => ({ ...row }));
  }

  async create(code: string): Promise<void> {
    this.rows.push({
      code,
      parentCode: null,
      path: null,
      permissionCode: null,
      title: null,
      icon: null,
      sort: null,
      visible: true,
      state: 'active',
    });
  }

  async activate(code: string): Promise<void> {
    this.mustFind(code).state = 'active';
  }

  async deprecate(code: string): Promise<void> {
    this.mustFind(code).state = 'deprecated';
  }

  async upsertOverride(): Promise<void> {
    throw new Error('同步禁止触碰覆盖列，不应调用');
  }

  private mustFind(code: string): NavigationNodeRow {
    const row = this.rows.find((item) => item.code === code);
    if (!row) throw new Error(`投影内不存在导航节点: ${code}`);
    return row;
  }
}

function makeService(permissionRows: PermissionPointRow[] = []) {
  const permissions = new FakePermissionPointRepository(permissionRows);
  const navigation = new FakeNavigationNodeRepository();
  return {
    permissions,
    navigation,
    service: new SyncService(permissions, navigation),
  };
}

describe('SyncService（目录 → 投影同步）', () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('权限点目录全部幂等 upsert：首次建行，再次同步不重复', async () => {
    const { permissions, service } = makeService();
    await service.onApplicationBootstrap();
    expect(permissions.rows.map((row) => row.code).sort()).toEqual(
      PERMISSION_CATALOG.map((def) => def.code).sort(),
    );
    const firstCount = permissions.rows.length;
    await service.onApplicationBootstrap();
    expect(permissions.rows).toHaveLength(firstCount);
  });

  it('目录内 deprecated 行复活为 active', async () => {
    const def = PERMISSION_CATALOG[0];
    const { permissions, service } = makeService([
      {
        code: def.code,
        resource: def.resource,
        action: def.action,
        summary: null,
        state: 'deprecated',
      },
    ]);
    await service.onApplicationBootstrap();
    expect(permissions.rows.find((row) => row.code === def.code)?.state).toBe(
      'active',
    );
  });

  it('代码中移除的权限点标记 deprecated，不物理删除', async () => {
    const { permissions, service } = makeService([
      {
        code: 'ghost:read',
        resource: 'ghost',
        action: 'read',
        summary: null,
        state: 'active',
      },
    ]);
    await service.onApplicationBootstrap();
    expect(
      permissions.rows.find((row) => row.code === 'ghost:read')?.state,
    ).toBe('deprecated');
  });

  it('结构镜像不一致只告警，不修改投影结构列', async () => {
    const def = PERMISSION_CATALOG[0];
    const { permissions, service } = makeService([
      {
        code: def.code,
        resource: 'legacy-resource',
        action: 'legacy-action',
        summary: '后台覆盖的说明',
        state: 'active',
      },
    ]);
    await service.onApplicationBootstrap();
    const row = permissions.rows.find((item) => item.code === def.code);
    expect(row).toMatchObject({
      resource: 'legacy-resource',
      action: 'legacy-action',
      summary: '后台覆盖的说明',
    });
    expect(Logger.prototype.warn).toHaveBeenCalledWith(
      expect.stringContaining('结构镜像不一致'),
    );
  });

  it('导航目录同步：新增建行、deprecated 复活、移除标记废弃', async () => {
    const { navigation, service } = makeService();
    await service.onApplicationBootstrap();
    const catalogCodes = NAVIGATION_CATALOG.map((def) => def.code);
    expect(navigation.rows.map((row) => row.code)).toEqual(catalogCodes);

    const revived = navigation.rows[0];
    revived.state = 'deprecated';
    navigation.rows.push({
      code: 'ghost.node',
      parentCode: null,
      path: '/ghost',
      permissionCode: null,
      title: null,
      icon: null,
      sort: null,
      visible: true,
      state: 'active',
    });
    await service.onApplicationBootstrap();
    expect(revived.state).toBe('active');
    expect(
      navigation.rows.find((row) => row.code === 'ghost.node')?.state,
    ).toBe('deprecated');
  });

  it('数据库缺席时同步告警不 crash（healthz 可启动）', async () => {
    const permissions = new FakePermissionPointRepository();
    permissions.findAll = async () => {
      throw new Error('connection refused');
    };
    const navigation = new FakeNavigationNodeRepository();
    const service = new SyncService(permissions, navigation);
    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
    expect(Logger.prototype.error).toHaveBeenCalled();
  });
});
