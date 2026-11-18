import { describe, expect, it } from 'vitest';
import type { Artifact } from '../../domain/artifact.entity';
import type { ArtifactRepository } from '../../domain/artifact.repository';
import type { Assignment } from '../../domain/assignment.entity';
import type { AssignmentRepository } from '../../domain/assignment.repository';
import type { Attention } from '../../domain/attention.entity';
import type { AttentionRepository } from '../../domain/attention.repository';
import type { Mandate } from '../../domain/mandate.entity';
import type { MandateRepository } from '../../domain/mandate.repository';
import { Ticket } from '../../domain/ticket.entity';
import type { TicketRepository } from '../../domain/ticket.repository';
import { TicketService } from '../ticket.service';

const AT = new Date('2026-11-16T00:00:00.000Z');
const LATER = new Date('2026-11-16T01:00:00.000Z');

class FakeTicketRepository implements TicketRepository {
  constructor(private readonly ticket: Ticket | null) {}
  async findById(id: string): Promise<Ticket | null> {
    return this.ticket?.id === id ? this.ticket : null;
  }
  async findByMandateId(): Promise<Ticket | null> {
    return this.ticket;
  }
  async list(): Promise<Ticket[]> {
    return this.ticket ? [this.ticket] : [];
  }
  async listByThread(): Promise<Ticket[]> {
    return [];
  }

  async save(): Promise<void> {}
}

class EmptyMandateRepository implements MandateRepository {
  async findById(): Promise<Mandate | null> {
    return null;
  }
  async create(): Promise<void> {}
}

class EmptyArtifactRepository implements ArtifactRepository {
  async findById(): Promise<Artifact | null> {
    return null;
  }
  async listByTicket(): Promise<Artifact[]> {
    return [];
  }
  async findLatest(): Promise<Artifact | null> {
    return null;
  }
  async save(): Promise<void> {}
}

class EmptyAttentionRepository implements AttentionRepository {
  async findById(): Promise<Attention | null> {
    return null;
  }
  async listOpenByTicket(): Promise<Attention[]> {
    return [];
  }
  async listOpen(): Promise<Attention[]> {
    return [];
  }
  async listByTicket(): Promise<Attention[]> {
    return [];
  }
  async save(): Promise<void> {}
}

class EmptyAssignmentRepository implements AssignmentRepository {
  async findById(): Promise<Assignment | null> {
    return null;
  }
  async listByTicket(): Promise<Assignment[]> {
    return [];
  }
  async findActiveByTicket(): Promise<Assignment | null> {
    return null;
  }
  async save(): Promise<void> {}
}

function makeService(ticket: Ticket | null): TicketService {
  return new TicketService(
    new FakeTicketRepository(ticket),
    new EmptyMandateRepository(),
    new EmptyArtifactRepository(),
    new EmptyAttentionRepository(),
    new EmptyAssignmentRepository(),
  );
}

function openTicket(): Ticket {
  return Ticket.open({
    id: 'ticket-1',
    mandateId: 'mandate-1',
    threadId: 'thread-1',
    kind: 'requirement',
    now: AT,
  });
}

describe('TicketService', () => {
  it('详情返回工单与空关联集合', async () => {
    const service = makeService(openTicket());
    const detail = await service.detail('ticket-1');
    expect(detail?.ticket.id).toBe('ticket-1');
    expect(detail?.mandate).toBeNull();
    expect(detail?.artifacts).toEqual([]);
  });

  it('工单不存在时详情为 null', async () => {
    const service = makeService(null);
    expect(await service.detail('missing')).toBeNull();
  });

  it('结束工单记录原因', async () => {
    const service = makeService(openTicket());
    const ticket = await service.end('ticket-1', '已交付', LATER);
    expect(ticket.status).toBe('ended');
    expect(ticket.endReason).toBe('已交付');
  });

  it('重新打开工单', async () => {
    const ticket = openTicket();
    ticket.end('误关闭', AT);
    const service = makeService(ticket);
    const reopened = await service.reopen('ticket-1', LATER);
    expect(reopened.status).toBe('open');
  });

  it('结束不存在的工单报错', async () => {
    const service = makeService(null);
    await expect(service.end('missing', 'x')).rejects.toThrow('工单不存在');
  });
});
