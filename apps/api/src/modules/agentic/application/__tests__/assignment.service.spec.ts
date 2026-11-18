import { describe, expect, it } from 'vitest';
import { Assignment } from '../../domain/assignment.entity';
import type { AssignmentRepository } from '../../domain/assignment.repository';
import { Ticket } from '../../domain/ticket.entity';
import type { TicketRepository } from '../../domain/ticket.repository';
import { AssignmentService } from '../assignment.service';

const AT = new Date('2026-11-16T00:00:00.000Z');
const LATER = new Date('2026-11-16T01:00:00.000Z');

class FakeAssignmentRepository implements AssignmentRepository {
  readonly rows = new Map<string, Assignment>();

  async findById(id: string): Promise<Assignment | null> {
    return this.rows.get(id) ?? null;
  }
  async listByTicket(ticketId: string): Promise<Assignment[]> {
    return [...this.rows.values()]
      .filter((assignment) => assignment.ticketId === ticketId)
      .sort(
        (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
      );
  }
  async findActiveByTicket(ticketId: string): Promise<Assignment | null> {
    return (
      [...this.rows.values()].find(
        (assignment) => assignment.ticketId === ticketId && !assignment.isEnded,
      ) ?? null
    );
  }
  async save(assignment: Assignment): Promise<void> {
    this.rows.set(assignment.id, assignment);
  }
}

class FakeTicketRepository implements TicketRepository {
  constructor(private readonly ticket: Ticket | null) {}
  async findById(): Promise<Ticket | null> {
    return this.ticket;
  }
  async findByMandateId(): Promise<Ticket | null> {
    return null;
  }
  async list(): Promise<Ticket[]> {
    return this.ticket ? [this.ticket] : [];
  }
  async listByThread(): Promise<Ticket[]> {
    return [];
  }

  async save(): Promise<void> {}
}

function makeService(ticket: Ticket | null): {
  service: AssignmentService;
  assignments: FakeAssignmentRepository;
} {
  const assignments = new FakeAssignmentRepository();
  return {
    service: new AssignmentService(
      assignments,
      new FakeTicketRepository(ticket),
    ),
    assignments,
  };
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

describe('AssignmentService', () => {
  it('为进行中工单创建派发', async () => {
    const { service, assignments } = makeService(openTicket());
    const assignment = await service.assign('ticket-1', AT);
    expect(assignment.attempt).toBe(1);
    expect(assignments.rows.size).toBe(1);
  });

  it('已有未结束派发时直接返回', async () => {
    const { service } = makeService(openTicket());
    const first = await service.assign('ticket-1', AT);
    const second = await service.assign('ticket-1', AT);
    expect(second.id).toBe(first.id);
  });

  it('已结束工单拒绝派发', async () => {
    const ticket = openTicket();
    ticket.end('已交付', LATER);
    const { service } = makeService(ticket);
    await expect(service.assign('ticket-1', AT)).rejects.toThrow(
      '工单已结束，不能派发',
    );
  });

  it('开始与结束推进状态', async () => {
    const { service } = makeService(openTicket());
    const assignment = await service.assign('ticket-1', AT);
    const running = await service.start(assignment.id, 'run-1', LATER);
    expect(running.status).toBe('running');
    const ended = await service.finish(assignment.id, 'timeout', LATER);
    expect(ended.status).toBe('ended');
    expect(ended.error).toBe('timeout');
  });
});
