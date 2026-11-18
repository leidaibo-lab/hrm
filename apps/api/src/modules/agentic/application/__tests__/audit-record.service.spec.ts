import { describe, expect, it } from 'vitest';
import type { AuditRecord } from '../../domain/audit-record.entity';
import type { AuditRecordRepository } from '../../domain/audit-record.repository';
import { AuditRecordService } from '../audit-record.service';

const AT = new Date('2026-11-16T00:00:00.000Z');

class FakeAuditRecordRepository implements AuditRecordRepository {
  async append(): Promise<AuditRecord> {
    throw new Error('未使用');
  }

  last: { action?: string; limit?: number } | null = null;
  async list(filter: {
    action?: string;
    actorId?: string;
    limit?: number;
  }): Promise<AuditRecord[]> {
    this.last = filter;
    return [
      {
        id: 'audit-1',
        traceId: 'trace-1',
        actorId: 'user-1',
        action: 'ticket.end',
        method: 'POST',
        path: '/api/v1/agentic/tickets/1/end',
        statusCode: 200,
        detail: {},
        createdAt: AT,
      },
    ];
  }
}

describe('AuditRecordService.list', () => {
  it('透传过滤条件', async () => {
    const repository = new FakeAuditRecordRepository();
    const service = new AuditRecordService(repository);
    const items = await service.list({ action: 'ticket.end', limit: 10 });
    expect(repository.last).toEqual({ action: 'ticket.end', limit: 10 });
    expect(items).toHaveLength(1);
  });
});
