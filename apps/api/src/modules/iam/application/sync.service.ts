import { NAVIGATION_CATALOG, PERMISSION_CATALOG } from '@cip/shared';
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import {
  NAVIGATION_NODE_REPOSITORY,
  type NavigationNodeRepository,
} from '../domain/navigation-node.repository';
import {
  PERMISSION_POINT_REPOSITORY,
  type PermissionPointRepository,
} from '../domain/permission-point.repository';

/**
 * 目录同步（应用层）：启动时把权限点目录与导航目录幂等 upsert 到投影表。
 * 规则：新增建行（覆盖列 null）；已存在只校验结构镜像、不触碰覆盖列；目录移除标记 deprecated。
 * DB 缺席时告警不 crash（healthz 可启动精神），下次启动自动补同步。
 */
@Injectable()
export class SyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @Inject(PERMISSION_POINT_REPOSITORY)
    private readonly permissionPoints: PermissionPointRepository,
    @Inject(NAVIGATION_NODE_REPOSITORY)
    private readonly navigationNodes: NavigationNodeRepository,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.syncPermissionPoints();
      await this.syncNavigationNodes();
    } catch (cause) {
      this.logger.error(
        `权限目录同步失败（数据库缺席？）: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }
  }

  private async syncPermissionPoints(): Promise<void> {
    const rows = await this.permissionPoints.findAll();
    const rowByCode = new Map(rows.map((row) => [row.code, row]));
    const catalogCodes = new Set(PERMISSION_CATALOG.map((def) => def.code));

    for (const def of PERMISSION_CATALOG) {
      const row = rowByCode.get(def.code);
      if (!row) {
        await this.permissionPoints.create({
          code: def.code,
          resource: def.resource,
          action: def.action,
        });
        continue;
      }
      // 结构镜像是契约列，同步只校验不修改；不一致说明 code 复用，需人工处理
      if (row.resource !== def.resource || row.action !== def.action) {
        this.logger.warn(
          `权限点 ${def.code} 结构镜像不一致: DB(${row.resource}:${row.action}) 目录(${def.resource}:${def.action})`,
        );
      }
      if (row.state === 'deprecated') {
        await this.permissionPoints.activate(def.code);
      }
    }
    for (const row of rows) {
      if (!catalogCodes.has(row.code) && row.state === 'active') {
        await this.permissionPoints.deprecate(row.code);
        this.logger.warn(`权限点 ${row.code} 已从目录移除，标记 deprecated`);
      }
    }
  }

  private async syncNavigationNodes(): Promise<void> {
    const rows = await this.navigationNodes.findAll();
    const rowByCode = new Map(rows.map((row) => [row.code, row]));
    const catalogCodes = new Set(NAVIGATION_CATALOG.map((def) => def.code));

    for (const def of NAVIGATION_CATALOG) {
      const row = rowByCode.get(def.code);
      if (!row) {
        await this.navigationNodes.create(def.code);
        continue;
      }
      if (
        row.parentCode !== def.parentCode ||
        row.path !== def.path ||
        row.permissionCode !== def.permissionCode
      ) {
        this.logger.warn(
          `导航节点 ${def.code} 结构镜像不一致: DB(parent=${row.parentCode}, path=${row.path}, perm=${row.permissionCode}) 目录(parent=${def.parentCode}, path=${def.path}, perm=${def.permissionCode})`,
        );
      }
      if (row.state === 'deprecated') {
        await this.navigationNodes.activate(def.code);
      }
    }
    for (const row of rows) {
      if (!catalogCodes.has(row.code) && row.state === 'active') {
        await this.navigationNodes.deprecate(row.code);
        this.logger.warn(`导航节点 ${row.code} 已从目录移除，标记 deprecated`);
      }
    }
  }
}
