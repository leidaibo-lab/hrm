/** 审计记录快照。 */
export interface AuditRecord {
  /** 主键。 */
  id: string;
  /** 追踪标识。 */
  traceId: string;
  /** 操作者。 */
  actorId: string | null;
  /** 动作。 */
  action: string;
  /** HTTP 方法。 */
  method: string;
  /** 路径。 */
  path: string;
  /** 状态码。 */
  statusCode: number;
  /** 详情。 */
  detail: unknown;
  /** 时间。 */
  createdAt: Date;
}

/** 创建审计记录的输入。 */
export interface CreateAuditRecordInput {
  /** 追踪标识。 */
  traceId: string;
  /** 操作者；系统运行可为 null。 */
  actorId: string | null;
  /** 动作标识。 */
  action: string;
  /** 调用方式：HTTP / WORKER。 */
  method: string;
  /** 动作目标路径或角色。 */
  path: string;
  /** 结果状态码；worker 运行约定 200/500。 */
  statusCode: number;
  /** 结构化详情。 */
  detail: unknown;
  /** 时间；缺省为当前时间。 */
  now?: Date;
}
