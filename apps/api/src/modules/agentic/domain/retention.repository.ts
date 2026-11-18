/** 保留归档仓储的 DI 令牌。 */
export const RETENTION_REPOSITORY = Symbol('RETENTION_REPOSITORY');

/** 各表保留阈值（早于该时间的记录过期）。 */
export interface RetentionCutoffs {
  /** 事件阈值。 */
  triggerBefore: Date;
  /** 出站消息阈值。 */
  outboundBefore: Date;
  /** 运行回报阈值。 */
  reportBefore: Date;
}

/** 过期记录计数。 */
export interface RetentionCounts {
  /** 过期事件数。 */
  triggers: number;
  /** 过期出站消息数。 */
  outbound: number;
  /** 过期回报数。 */
  reports: number;
}

/** 保留归档仓储：计数与删除（只处理已终态记录）。 */
export interface RetentionRepository {
  /** 统计过期记录。 */
  countExpired(cutoffs: RetentionCutoffs): Promise<RetentionCounts>;
  /** 删除过期记录。 */
  deleteExpired(cutoffs: RetentionCutoffs): Promise<RetentionCounts>;
}
