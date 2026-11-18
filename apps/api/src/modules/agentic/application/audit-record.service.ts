import { Inject, Injectable } from '@nestjs/common';
import type {
  AuditRecord,
  CreateAuditRecordInput,
} from '../domain/audit-record.entity';
import {
  AUDIT_RECORD_REPOSITORY,
  type AuditRecordRepository,
} from '../domain/audit-record.repository';

/** 审计记录读取。 */
@Injectable()
export class AuditRecordService {
  constructor(
    @Inject(AUDIT_RECORD_REPOSITORY)
    private readonly records: AuditRecordRepository,
  ) {}

  /** 追加一条审计记录；写失败由调用方决定是否降级。 */
  async record(input: CreateAuditRecordInput): Promise<AuditRecord> {
    return this.records.append(input);
  }

  /** 查询审计记录。 */
  async list(filter: {
    action?: string;
    actorId?: string;
    traceId?: string;
    offset?: number;
    limit?: number;
  }): Promise<AuditRecord[]> {
    return this.records.list(filter);
  }
}
