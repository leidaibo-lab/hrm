import { Inject, Injectable } from '@nestjs/common';
import type { Artifact } from '../domain/artifact.entity';
import {
  ARTIFACT_REPOSITORY,
  type ArtifactRepository,
} from '../domain/artifact.repository';
import type { Assignment } from '../domain/assignment.entity';
import {
  ASSIGNMENT_REPOSITORY,
  type AssignmentRepository,
} from '../domain/assignment.repository';
import type { Attention } from '../domain/attention.entity';
import {
  ATTENTION_REPOSITORY,
  type AttentionRepository,
} from '../domain/attention.repository';
import type { Mandate } from '../domain/mandate.entity';
import {
  MANDATE_REPOSITORY,
  type MandateRepository,
} from '../domain/mandate.repository';
import { metrics } from '../domain/metrics.port';
import type { Ticket, TicketStatus } from '../domain/ticket.entity';
import {
  TICKET_REPOSITORY,
  type TicketRepository,
} from '../domain/ticket.repository';

/** 工单列表条件。 */
export interface ListTicketsInput {
  /** 状态过滤。 */
  status?: TicketStatus;
  /** 项目或空间过滤。 */
  scopeKey?: string;
  /** 返回上限。 */
  limit?: number;
}

/** 工单详情：工单 + 授权 + 产物 + 关注 + 派发。 */
export interface TicketDetail {
  /** 工单。 */
  ticket: Ticket;
  /** 授权。 */
  mandate: Mandate | null;
  /** 产物。 */
  artifacts: Artifact[];
  /** 未关闭关注。 */
  attentions: Attention[];
  /** 派发记录。 */
  assignments: Assignment[];
}

/** 工单用例：列表、详情与状态变更。 */
@Injectable()
export class TicketService {
  constructor(
    @Inject(TICKET_REPOSITORY) private readonly tickets: TicketRepository,
    @Inject(MANDATE_REPOSITORY) private readonly mandates: MandateRepository,
    @Inject(ARTIFACT_REPOSITORY) private readonly artifacts: ArtifactRepository,
    @Inject(ATTENTION_REPOSITORY)
    private readonly attentions: AttentionRepository,
    @Inject(ASSIGNMENT_REPOSITORY)
    private readonly assignments: AssignmentRepository,
  ) {}

  /** 列出工单。 */
  async list(
    input: ListTicketsInput = {},
    scopeKeys?: string[],
  ): Promise<Ticket[]> {
    return this.tickets.list({ ...input, ...(scopeKeys ? { scopeKeys } : {}) });
  }

  /** 列出工单及其未关闭关注（列表页负责人/超时标记用）。 */
  async listWithWaiting(
    input: ListTicketsInput = {},
    scopeKeys?: string[],
  ): Promise<Array<{ ticket: Ticket; attentions: Attention[] }>> {
    const tickets = await this.tickets.list({
      ...input,
      ...(scopeKeys ? { scopeKeys } : {}),
    });
    return Promise.all(
      tickets.map(async (ticket) => ({
        ticket,
        attentions: await this.attentions.listOpenByTicket(ticket.id),
      })),
    );
  }

  /** 取工单详情；工单不存在返回 null。 */
  async detail(id: string): Promise<TicketDetail | null> {
    const ticket = await this.tickets.findById(id);
    if (!ticket) return null;

    const [mandate, artifacts, attentions, assignments] = await Promise.all([
      this.mandates.findById(ticket.mandateId),
      this.artifacts.listByTicket(id),
      this.attentions.listOpenByTicket(id),
      this.assignments.listByTicket(id),
    ]);
    return { ticket, mandate, artifacts, attentions, assignments };
  }

  /** 结束工单；原因必填。 */
  async end(
    id: string,
    reason: string,
    now: Date = new Date(),
  ): Promise<Ticket> {
    const ticket = await this.load(id);
    ticket.end(reason, now);
    await this.tickets.save(ticket);
    metrics.increment('agentic_events_total', { event: 'ticket_ended' });
    return ticket;
  }

  /** 重新打开工单。 */
  async reopen(id: string, now: Date = new Date()): Promise<Ticket> {
    const ticket = await this.load(id);
    ticket.reopen(now);
    await this.tickets.save(ticket);
    return ticket;
  }

  private async load(id: string): Promise<Ticket> {
    const ticket = await this.tickets.findById(id);
    if (!ticket) throw new Error(`工单不存在：${id}`);
    return ticket;
  }
}
