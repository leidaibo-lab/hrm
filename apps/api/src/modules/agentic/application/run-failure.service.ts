import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Attention } from '../domain/attention.entity';
import {
  ATTENTION_REPOSITORY,
  type AttentionRepository,
} from '../domain/attention.repository';
import {
  MANDATE_REPOSITORY,
  type MandateRepository,
} from '../domain/mandate.repository';
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

/** 运行失败转人工的默认处理时限：24 小时。 */
const FAILURE_DEADLINE_MS = 24 * 60 * 60 * 1000;

/** 运行失败上报输入。 */
export interface ReportRunFailureInput {
  /** 所属工单主键。 */
  ticketId: string;
  /** 失败角色（clarify/breakdown 等）。 */
  role: string;
  /** 失败原因。 */
  error: string;
  /** 当前时间；缺省为系统时间。 */
  now?: Date;
}

/**
 * 运行失败转人工：worker 重试耗尽后写 review 关注，避免失败静默。
 * 同一工单已有未关闭 review 关注时不重复创建。
 */
@Injectable()
export class RunFailureService {
  private readonly logger = new Logger(RunFailureService.name);

  constructor(
    @Inject(TICKET_REPOSITORY) private readonly tickets: TicketRepository,
    @Inject(POLICY_REPOSITORY) private readonly policies: PolicyRepository,
    @Inject(MANDATE_REPOSITORY) private readonly mandates: MandateRepository,
    @Inject(ATTENTION_REPOSITORY)
    private readonly attentions: AttentionRepository,
    private readonly attentionService: AttentionService,
  ) {}

  /** 上报失败；工单已结束或策略缺失时跳过。 */
  async report(input: ReportRunFailureInput): Promise<Attention | null> {
    const ticket = await this.tickets.findById(input.ticketId);
    if (!ticket?.isOpen) return null;
    const policy = await this.policies.findCurrent();
    if (!policy) return null;

    const open = await this.attentions.listOpenByTicket(ticket.id);
    if (open.some((attention) => attention.kind === 'review')) return null;

    const mandate = await this.mandates.findById(ticket.mandateId);
    const assignee = readEscalationOwner(policy.rules, mandate?.sourceType);
    const now = input.now ?? new Date();
    const attention = await this.attentionService.ask({
      ticketId: ticket.id,
      kind: 'review',
      question: `${input.role} 运行失败，请人工处理：${input.error}`,
      deadline: new Date(now.getTime() + FAILURE_DEADLINE_MS),
      assignee: assignee ?? mandate?.actorId,
      now,
    });
    this.logger.warn(`运行失败已转人工：${ticket.id} / ${input.role}`);
    return attention;
  }
}
