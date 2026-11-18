import {
  ERROR_CODE,
  isIconKey,
  mergeNavigation,
  NAVIGATION_CATALOG,
  type NavigationNodeDto,
} from '@cip/shared';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NAVIGATION_NODE_REPOSITORY,
  type NavigationNodeRepository,
} from '../domain/navigation-node.repository';

/** 导航覆盖行视图（后台菜单管理页）：目录默认值与覆盖值并列展示。 */
export interface NavigationNodeView {
  /** 业务编码。 */
  code: string;
  /** 父级编码。 */
  parentCode: string | null;
  /** 路径。 */
  path: string | null;
  /** 权限点编码。 */
  permissionCode: string | null;
  /** 状态。 */
  state: 'active' | 'deprecated';
  /** 默认标题。 */
  defaultTitle: string;
  /** 标题。 */
  title: string | null;
  /** 默认图标。 */
  defaultIcon: string | null;
  /** 图标。 */
  icon: string | null;
  /** 默认排序值。 */
  defaultSort: number;
  /** 排序值。 */
  sort: number | null;
  /** 是否可见。 */
  visible: boolean;
}

/** 导航展示服务（应用层）：/me 树组装（覆盖合并 + 过滤）与后台覆盖管理。 */
@Injectable()
export class NavigationService {
  constructor(
    @Inject(NAVIGATION_NODE_REPOSITORY)
    private readonly navigationNodes: NavigationNodeRepository,
  ) {}

  /**
   * 组装 /me 导航树：active 投影行 + 会话权限点 → shared 合并（覆盖 ⊕ 默认、visible 与权限过滤）。
   * @param permissions - 会话权限点集合，"*" 表示全量。
   */
  async getTree(permissions: readonly string[]): Promise<NavigationNodeDto[]> {
    const rows = await this.navigationNodes.findAll();
    const overrides = rows
      .filter((row) => row.state === 'active')
      .map((row) => ({
        code: row.code,
        title: row.title,
        icon: row.icon,
        sort: row.sort,
        visible: row.visible,
      }));
    return mergeNavigation(overrides, permissions);
  }

  /**
   * 后台菜单管理页数据：目录定义 ⊕ DB 覆盖行并列展示。
   * 目录中尚未同步建行的条目按「无覆盖、active」呈现。
   */
  async list(): Promise<NavigationNodeView[]> {
    const rows = await this.navigationNodes.findAll();
    const rowByCode = new Map(rows.map((row) => [row.code, row]));
    return NAVIGATION_CATALOG.map((def, index) => {
      const row = rowByCode.get(def.code);
      return {
        code: def.code,
        parentCode: def.parentCode,
        path: def.path,
        permissionCode: def.permissionCode,
        state: row?.state ?? 'active',
        defaultTitle: def.title,
        title: row?.title ?? null,
        defaultIcon: def.icon,
        icon: row?.icon ?? null,
        defaultSort: (index + 1) * 10,
        sort: row?.sort ?? null,
        visible: row?.visible ?? true,
      };
    });
  }

  /**
   * 更新导航覆盖列；字段传 null 表示恢复目录默认。
   * @throws code 不在目录时 404；icon 非法键时 400。
   */
  async updateOverride(
    code: string,
    patch: {
      title: string | null;
      icon: string | null;
      sort: number | null;
      visible: boolean;
    },
  ): Promise<NavigationNodeView> {
    const def = NAVIGATION_CATALOG.find((item) => item.code === code);
    if (!def) {
      throw new NotFoundException({
        code: ERROR_CODE.navigation.nodeNotFound,
        message: `导航节点 ${code} 不在目录中`,
      });
    }
    if (patch.icon !== null && !isIconKey(patch.icon)) {
      throw new BadRequestException({
        code: ERROR_CODE.request.invalid,
        message: `未知图标键: ${patch.icon}`,
      });
    }
    await this.navigationNodes.upsertOverride(code, patch);
    const list = await this.list();
    const updated = list.find((item) => item.code === code);
    if (!updated) {
      throw new NotFoundException({
        code: ERROR_CODE.navigation.nodeNotFound,
        message: `导航节点 ${code} 更新后未找到`,
      });
    }
    return updated;
  }
}
