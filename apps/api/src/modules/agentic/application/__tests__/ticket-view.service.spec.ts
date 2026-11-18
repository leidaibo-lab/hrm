import { describe, expect, it } from 'vitest';
import { Attention } from '../../domain/attention.entity';
import { Ticket } from '../../domain/ticket.entity';
import { Trigger } from '../../domain/trigger.entity';
import { toTicketView, toTriggerView } from '../ticket-view.service';

const AT = new Date('2026-11-16T00:00:00.000Z');

function ticket(): Ticket {
  return Ticket.open({
    id: 'ticket-1',
    mandateId: 'mandate-1',
    threadId: 'thread-1',
    kind: 'requirement',
    scopeKey: 'project-a',
    now: AT,
  });
}

function attention(deadline: Date, assignee: string): Attention {
  return Attention.create({
    id: 'attention-1',
    ticketId: 'ticket-1',
    kind: 'clarify',
    question: '问题',
    deadline,
    assignee,
    now: AT,
  });
}

describe('toTicketView 等待信息', () => {
  it('取最早截止的未关闭关注作为负责人与超时标记', () => {
    const view = toTicketView(ticket(), [
      attention(new Date(AT.getTime() + 3_600_000), 'user-b'),
      attention(new Date(AT.getTime() - 60_000), 'user-a'),
    ]);

    expect(view.assignee).toBe('user-a');
    expect(view.waitingCount).toBe(2);
    expect(view.overdue).toBe(true);
    expect(view.deadline).toBe(new Date(AT.getTime() - 60_000).toISOString());
  });

  it('无未关闭关注时负责人为空且不逾期', () => {
    const view = toTicketView(ticket(), []);

    expect(view).not.toHaveProperty('assignee');
    expect(view).not.toHaveProperty('deadline');
    expect(view.overdue).toBe(false);
    expect(view.waitingCount).toBe(0);
  });
});

describe('toTriggerView 来源与过滤原因', () => {
  it('逐事件标注来源并带过滤原因', () => {
    const trigger = Trigger.create({
      id: 'trigger-1',
      dedupeKey: 'lark:1',
      sourceType: 'lark',
      instanceId: 'instance-1',
      threadId: 'thread-1',
      actorId: 'actor-1',
      text: '无关消息',
      payload: {},
      occurredAt: AT,
    });
    trigger.markFiltered(AT, 'no_rule');

    const view = toTriggerView(trigger);

    expect(view.sourceType).toBe('lark');
    expect(view.filterReason).toBe('no_rule');
    expect(view.disposition).toBe('filtered');
  });
});
