import type {
  AuditRecord,
  CreateAuditRecordInput,
} from './audit-record.entity';

/** 审计记录仓储的 DI 令牌。 */
export const AUDIT_RECORD_REPOSITORY = Symbol('AUDIT_RECORD_REPOSITORY');

/** 审计记录查询。 */
export interface AuditRecordRepository {
  /** 按动作/操作者过滤，按时间倒序。 */
  /** 追加一条审计记录。 */
  append(input: CreateAuditRecordInput): Promise<AuditRecord>;
  /** 按条件查询。 */
  list(filter: {
    action?: string;
    actorId?: string;
    traceId?: string;
    offset?: number;
    limit?: number;
  }): Promise<AuditRecord[]>;
}
