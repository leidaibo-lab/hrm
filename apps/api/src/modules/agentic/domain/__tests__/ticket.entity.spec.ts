import { describe, expect, it } from 'vitest';
import { Ticket } from '../ticket.entity';

const AT = new Date('2026-11-16T00:00:00.000Z');
const LATER = new Date('2026-11-16T02:00:00.000Z');

function openTicket(): Ticket {
  return Ticket.open({
    id: 'ticket-1',
    mandateId: 'mandate-1',
    threadId: 'thread-1',
    scopeKey: 'project-a',
    kind: 'requirement',
    now: AT,
  });
}

describe('Ticket 聚合', () => {
  it('开启后为进行中', () => {
    const ticket = openTicket();
    expect(ticket.isOpen).toBe(true);
    expect(ticket.endedAt).toBeNull();
  });

  it('结束工单记录原因与时间', () => {
    const ticket = openTicket();
    ticket.end('  已交付  ', LATER);
    expect(ticket.isOpen).toBe(false);
    expect(ticket.endReason).toBe('已交付');
    expect(ticket.endedAt).toEqual(LATER);
  });

  it('重复结束幂等', () => {
    const ticket = openTicket();
    ticket.end('已交付', LATER);
    ticket.end('另一个原因', LATER);
    expect(ticket.endReason).toBe('已交付');
  });

  it('结束原因不能为空', () => {
    const ticket = openTicket();
    expect(() => ticket.end('  ', LATER)).toThrow('结束原因不能为空');
  });

  it('重新打开清除结束状态', () => {
    const ticket = openTicket();
    ticket.end('误关闭', LATER);
    ticket.reopen(LATER);
    expect(ticket.isOpen).toBe(true);
    expect(ticket.endedAt).toBeNull();
    expect(ticket.endReason).toBeNull();
  });

  it('快照可重建等价聚合', () => {
    const ticket = openTicket();
    const restored = Ticket.rehydrate(ticket.toSnapshot());
    expect(restored.toSnapshot()).toEqual(ticket.toSnapshot());
  });
});
