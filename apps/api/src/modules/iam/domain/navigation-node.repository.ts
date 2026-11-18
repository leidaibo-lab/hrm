/** 注入令牌：模块内以 useClass 绑定 infrastructure 实现。 */
export const NAVIGATION_NODE_REPOSITORY = Symbol('NAVIGATION_NODE_REPOSITORY');

/** 导航投影行：结构列（同步维护，覆盖禁止）+ 覆盖列（后台可写，null = 跟随目录默认）。 */
export interface NavigationNodeRow {
  /** 业务编码。 */
  code: string;
  /** 父级编码。 */
  parentCode: string | null;
  /** 路径。 */
  path: string | null;
  /** 权限点编码。 */
  permissionCode: string | null;
  /** 标题。 */
  title: string | null;
  /** 图标。 */
  icon: string | null;
  /** 排序值。 */
  sort: number | null;
  /** 是否可见。 */
  visible: boolean;
  /** 状态。 */
  state: 'active' | 'deprecated';
}

/** 导航投影端口：无独立聚合（结构语义由目录派生），仅暴露定向读写。 */
export interface NavigationNodeRepository {
  /** 全量投影行（getTree 取 active 子集；list 与同步用全量）。 */
  findAll(): Promise<NavigationNodeRow[]>;
  /** 同步建行：目录新增条目（覆盖列 null）。 */
  create(code: string): Promise<void>;
  /** 同步复活：deprecated → active。 */
  activate(code: string): Promise<void>;
  /** 同步废弃：active → deprecated。 */
  deprecate(code: string): Promise<void>;
  /** 覆盖列更新：null 恢复目录默认；投影行缺席时建行。 */
  upsertOverride(
    code: string,
    patch: {
      title: string | null;
      icon: string | null;
      sort: number | null;
      visible: boolean;
    },
  ): Promise<void>;
}
