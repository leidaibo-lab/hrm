import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Assignment } from '../domain/assignment.entity';
import {
  ASSIGNMENT_REPOSITORY,
  type AssignmentRepository,
} from '../domain/assignment.repository';
import {
  TICKET_REPOSITORY,
  type TicketRepository,
} from '../domain/ticket.repository';

/** 派发用例：为工单创建执行绑定并推进运行状态。 */
@Injectable()
export class AssignmentService {
  constructor(
    @Inject(ASSIGNMENT_REPOSITORY)
    private readonly assignments: AssignmentRepository,
    @Inject(TICKET_REPOSITORY)
    private readonly tickets: TicketRepository,
  ) {}

  /** 为工单派发；已有未结束派发时直接返回它。 */
  async assign(ticketId: string, now: Date = new Date()): Promise<Assignment> {
    const ticket = await this.tickets.findById(ticketId);
    if (!ticket) throw new Error(`工单不存在：${ticketId}`);
    if (!ticket.isOpen) throw new Error('工单已结束，不能派发');

    const active = await this.assignments.findActiveByTicket(ticketId);
    if (active) return active;

    const existing = await this.assignments.listByTicket(ticketId);
    const assignment = Assignment.create({
      id: randomUUID(),
      ticketId,
      attempt: existing.length + 1,
      now,
    });
    await this.assignments.save(assignment);
    return assignment;
  }

  /** 开始执行。 */
  async start(
    id: string,
    executorRunId: string,
    now: Date = new Date(),
  ): Promise<Assignment> {
    const assignment = await this.load(id);
    assignment.start(executorRunId, now);
    await this.assignments.save(assignment);
    return assignment;
  }

  /** 结束执行；error 为空表示正常结束。 */
  async finish(
    id: string,
    error: string | null = null,
    now: Date = new Date(),
  ): Promise<Assignment> {
    const assignment = await this.load(id);
    assignment.end(now, error);
    await this.assignments.save(assignment);
    return assignment;
  }

  private async load(id: string): Promise<Assignment> {
    const assignment = await this.assignments.findById(id);
    if (!assignment) throw new Error(`派发不存在：${id}`);
    return assignment;
  }
}
