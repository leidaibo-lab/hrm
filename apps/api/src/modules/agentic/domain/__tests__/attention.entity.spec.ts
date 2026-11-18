import { describe, expect, it } from 'vitest';
import { Attention } from '../attention.entity';

const AT = new Date('2026-11-16T00:00:00.000Z');
const LATER = new Date('2026-11-16T01:00:00.000Z');

function createAttention(
  deadline: Date = new Date(AT.getTime() + 4 * 3_600_000),
): Attention {
  return Attention.create({
    id: 'attention-1',
    ticketId: 'ticket-1',
    kind: 'clarify',
    question: '验收标准是什么？',
    options: ['按 PRD', '补充说明'],
    assignee: 'ou-owner',
    deadline,
    now: AT,
  });
}

describe('Attention 聚合', () => {
  it('创建后为待答', () => {
    const attention = createAttention();
    expect(attention.status).toBe('open');
    expect(attention.isOpen(AT)).toBe(true);
  });

  it('回答后记录答案与决定人', () => {
    const attention = createAttention();
    attention.answerWith('按 PRD', 'user-1', LATER);
    expect(attention.status).toBe('answered');
    expect(attention.answer).toBe('按 PRD');
    expect(attention.decidedBy).toBe('user-1');
  });

  it('已回答不能重复回答', () => {
    const attention = createAttention();
    attention.answerWith('按 PRD', 'user-1', LATER);
    expect(() => attention.answerWith('另一个', 'user-2', LATER)).toThrow(
      '关注已关闭，不能回答',
    );
  });

  it('超过截止时间不能回答', () => {
    const attention = createAttention(LATER);
    expect(() => attention.answerWith('按 PRD', 'user-1', LATER)).toThrow(
      '关注已过期，不能回答',
    );
  });

  it('过期后不能回答', () => {
    const attention = createAttention();
    attention.expire(LATER);
    expect(attention.status).toBe('expired');
    expect(() => attention.answerWith('按 PRD', 'user-1', LATER)).toThrow(
      '关注已关闭，不能回答',
    );
  });

  it('等待对象随快照保留，缺失时报错', () => {
    const attention = Attention.create({
      id: 'attention-2',
      ticketId: 'ticket-1',
      kind: 'review',
      question: '是否继续？',
      assignee: ' ou-owner ',
      deadline: LATER,
      now: AT,
    });
    expect(attention.assignee).toBe('ou-owner');
    expect(Attention.rehydrate(attention.toSnapshot()).assignee).toBe(
      'ou-owner',
    );
    expect(() =>
      Attention.create({
        id: 'attention-3',
        ticketId: 'ticket-1',
        kind: 'review',
        question: '是否继续？',
        assignee: '  ',
        deadline: LATER,
        now: AT,
      }),
    ).toThrow('关注必须有等待对象');
    expect(() =>
      Attention.create({
        id: 'attention-4',
        ticketId: 'ticket-1',
        kind: 'review',
        question: '是否继续？',
        assignee: 'ou-owner',
        deadline: new Date('invalid'),
        now: AT,
      }),
    ).toThrow('关注必须有合法时限');
  });

  it('快照可重建等价聚合', () => {
    const attention = createAttention();
    attention.answerWith('按 PRD', 'user-1', LATER);
    const restored = Attention.rehydrate(attention.toSnapshot());
    expect(restored.toSnapshot()).toEqual(attention.toSnapshot());
  });
});
