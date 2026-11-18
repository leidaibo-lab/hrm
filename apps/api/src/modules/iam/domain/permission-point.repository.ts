/** 注入令牌：模块内以 useClass 绑定 infrastructure 实现。 */
export const PERMISSION_POINT_REPOSITORY = Symbol(
  'PERMISSION_POINT_REPOSITORY',
);

/** 权限点投影行：目录（唯一事实源）的 DB 投影；结构列由同步服务维护。 */
export interface PermissionPointRow {
  /** 业务编码。 */
  code: string;
  /** 资源名称。 */
  resource: string;
  /** 操作名称。 */
  action: string;
  /** 摘要。 */
  summary: string | null;
  /** 状态。 */
  state: 'active' | 'deprecated';
}

/** 权限点投影端口：无独立聚合（投影行语义由目录派生），仅暴露定向读写。 */
export interface PermissionPointRepository {
  /** 列出全部记录。 */
  findAll(): Promise<PermissionPointRow[]>;
  /** active 权限点 code 清单（授予关系校验用）。 */
  findActiveCodes(codes: string[]): Promise<string[]>;
  /** 同步建行：目录新增条目（覆盖列 null）。 */
  create(entry: {
    code: string;
    resource: string;
    action: string;
  }): Promise<void>;
  /** 同步复活：deprecated → active。 */
  activate(code: string): Promise<void>;
  /** 同步废弃：active → deprecated。 */
  deprecate(code: string): Promise<void>;
  /** 摘要覆盖：null 恢复目录默认；投影行缺席时携结构列建行。 */
  upsertSummary(
    code: string,
    structure: { resource: string; action: string },
    summary: string | null,
  ): Promise<void>;
}
