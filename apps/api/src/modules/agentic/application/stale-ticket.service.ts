import { Inject, Injectable } from '@nestjs/common';
import {
  ASSIGNMENT_REPOSITORY,
  type AssignmentRepository,
} from '../domain/assignment.repository';
import {
  ATTENTION_REPOSITORY,
  type AttentionRepository,
} from '../domain/attention.repository';
import type { MandateRepository } from '../domain/mandate.repository';
import { MANDATE_REPOSITORY } from '../domain/mandate.repository';
import { readEscalationOwner } from '../domain/policy.entity';
import {
  POLICY_REPOSITORY,
  type PolicyRepository,
} from '../domain/policy.repository';
import {
  TICKET_REPOSITORY,
  type TicketRepository,
} from '../domain/ticket.repository';
import { AttentionService } from './attention.service';
import { ThreadNotifierService } from './thread-notifier.service';

/** 停滞判定阈值：默认 24 小时。 */
const DEFAULT_STALE_MS = 24 * 60 * 60 * 1000;
/** 升级关注的答复期限：默认 24 小时。 */
const ESCALATION_DEADLINE_MS = 24 * 60 * 60 * 1000;
/** 单次扫描工单上限。 */
const SCAN_LIMIT = 100;

/** 停滞工单扫描：无进展且无待答关注时，生成升级关注。 */
@Injectable()
export class StaleTicketService {
  constructor(
    @Inject(TICKET_REPOSITORY) private readonly tickets: TicketRepository,
    @Inject(ATTENTION_REPOSITORY)
    private readonly attentions: AttentionRepository,
    @Inject(ASSIGNMENT_REPOSITORY)
    private readonly assignments: AssignmentRepository,
    private readonly attentionService: AttentionService,
    private readonly notifier: ThreadNotifierService,
    @Inject(POLICY_REPOSITORY) private readonly policies: PolicyRepository,
    @Inject(MANDATE_REPOSITORY)
    private readonly mandates: MandateRepository,
  ) {}

  /** 扫描并生成升级关注，返回新增数量。 */
  async scan(
    now: Date = new Date(),
    staleMs: number = DEFAULT_STALE_MS,
  ): Promise<number> {
    const cutoff = now.getTime() - staleMs;
    const policy = await this.policies.findCurrent();
    const rules = policy?.rules;
    const tickets = await this.tickets.list({
      status: 'open',
      limit: SCAN_LIMIT,
    });
    let created = 0;

    for (const ticket of tickets) {
      if (ticket.openedAt.getTime() > cutoff) continue;
      const [openAttentions, activeAssignment] = await Promise.all([
        this.attentions.listOpenByTicket(ticket.id),
        this.assignments.findActiveByTicket(ticket.id),
      ]);
      if (openAttentions.length > 0 || activeAssignment) continue;

      const mandate = await this.mandates.findById(ticket.mandateId);
      const owner = readEscalationOwner(rules, mandate?.sourceType);
      const hours = Math.floor(
        (now.getTime() - ticket.openedAt.getTime()) / 3_600_000,
      );
      await this.attentionService.ask({
        ticketId: ticket.id,
        kind: 'review',
        question: `工单已停滞 ${hours} 小时，请确认是否继续。`,
        deadline: new Date(now.getTime() + ESCALATION_DEADLINE_MS),
        assignee: owner ?? mandate?.actorId,
        now,
      });
      await this.notifier.notify(
        ticket.threadId,
        `工单已停滞 ${hours} 小时，请${
          owner ? ` <at user_id="${owner}"></at>` : ''
        }到待办关注处理。`,
        `stale:${ticket.id}:${hours}`,
      );
      created += 1;
    }
    return created;
  }
}
