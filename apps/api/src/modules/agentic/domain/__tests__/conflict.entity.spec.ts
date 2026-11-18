import { describe, expect, it } from 'vitest';
import { detectConflicts } from '../conflict.entity';
import { Ticket } from '../ticket.entity';
import { Trigger } from '../trigger.entity';

const AT = new Date('2026-11-16T00:00:00.000Z');

function trigger(id: string, text: string): Trigger {
  return Trigger.create({
    id,
    dedupeKey: id,
    sourceType: 'lark',
    instanceId: 'instance-1',
    threadId: 'thread-1',
    actorId: 'actor-1',
    text,
    payload: {},
    occurredAt: AT,
  });
}

function ticket(id: string): Ticket {
  return Ticket.open({
    id,
    mandateId: 'mandate-1',
    threadId: 'thread-1',
    kind: 'requirement',
    now: AT,
  });
}

describe('detectConflicts', () => {
  it('进行中工单遇到取消请求时标记冲突', () => {
    const conflicts = detectConflicts(
      [trigger('t1', '需求先做导出'), trigger('t2', '这个需求取消吧')],
      [ticket('ticket-1')],
    );

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      kind: 'cancellation_request',
      triggerId: 't2',
      ticketId: 'ticket-1',
    });
  });

  it('无进行中工单或无关文本时不标记', () => {
    expect(detectConflicts([trigger('t1', '取消')], [])).toEqual([]);
    expect(
      detectConflicts([trigger('t1', '补充验收标准')], [ticket('ticket-1')]),
    ).toEqual([]);
  });

  it('识别范围、优先级与时限变更', () => {
    const conflicts = detectConflicts(
      [
        trigger('t1', '需求范围扩大，加上批量导出'),
        trigger('t2', '优先级调整到 P0，很紧急'),
        trigger('t3', '上线截止时间提前一周'),
      ],
      [ticket('ticket-1')],
    );

    expect(conflicts.map((conflict) => conflict.kind)).toEqual([
      'deadline_change',
      'priority_change',
      'scope_change',
    ]);
  });

  it('同一事件最多返回 3 条冲突', () => {
    const conflicts = detectConflicts(
      [trigger('t1', '需求范围扩大，优先级调到 P0，截止时间提前')],
      [ticket('ticket-1'), ticket('ticket-2')],
    );
    expect(conflicts).toHaveLength(3);
  });
});
