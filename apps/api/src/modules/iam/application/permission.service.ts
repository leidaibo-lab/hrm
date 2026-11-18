import { ERROR_CODE, PERMISSION_CATALOG } from '@cip/shared';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  PERMISSION_POINT_REPOSITORY,
  type PermissionPointRepository,
} from '../domain/permission-point.repository';

/** 权限点清单条目：目录默认值 ⊕ DB 覆盖合并后的生效形态（后台权限点管理页用）。 */
export interface PermissionPointView {
  /** 业务编码。 */
  code: string;
  /** 资源名称。 */
  resource: string;
  /** 操作名称。 */
  action: string;
  /** 生效摘要：覆盖 ?? 目录默认。 */
  summary: string;
  /** 目录默认摘要；等于生效摘要时后台不显示覆盖提示。 */
  defaultSummary: string;
  /** 状态。 */
  state: 'active' | 'deprecated';
}

/**
 * 权限点视图服务（应用层）：目录（唯一事实源）与 DB 投影的合并读 + 摘要覆盖写。
 * 结构列（resource/action/state）由同步服务维护，本服务不触碰。
 */
@Injectable()
export class PermissionService {
  constructor(
    @Inject(PERMISSION_POINT_REPOSITORY)
    private readonly permissionPoints: PermissionPointRepository,
  ) {}

  async list(): Promise<PermissionPointView[]> {
    const rows = await this.permissionPoints.findAll();
    const rowByCode = new Map(rows.map((row) => [row.code, row]));
    return PERMISSION_CATALOG.map((def) => {
      const row = rowByCode.get(def.code);
      const summary = row?.summary ?? def.summary;
      return {
        code: def.code,
        resource: def.resource,
        action: def.action,
        summary,
        defaultSummary: def.summary,
        state: row?.state ?? 'active',
      };
    });
  }

  /**
   * 覆盖权限点展示摘要；null 恢复目录默认。
   * @throws 权限点不在目录时 404（目录外的 code 无覆盖意义）。
   */
  async updateSummary(
    code: string,
    summary: string | null,
  ): Promise<PermissionPointView> {
    const def = PERMISSION_CATALOG.find((item) => item.code === code);
    if (!def) {
      throw new NotFoundException({
        code: ERROR_CODE.role.unknownPermission,
        message: `权限点 ${code} 不在目录中`,
      });
    }
    await this.permissionPoints.upsertSummary(
      code,
      { resource: def.resource, action: def.action },
      summary,
    );
    const list = await this.list();
    const updated = list.find((item) => item.code === code);
    if (!updated) {
      throw new NotFoundException({
        code: ERROR_CODE.role.unknownPermission,
        message: `权限点 ${code} 更新后未找到`,
      });
    }
    return updated;
  }
}
