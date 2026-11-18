import { describe, expect, it } from 'vitest';
import { OutboundMessage } from '../outbound-message.entity';

const AT = new Date('2026-11-16T00:00:00.000Z');
const LATER = new Date('2026-11-16T00:00:30.000Z');

function createMessage(): OutboundMessage {
  return OutboundMessage.create({
    id: 'outbound-1',
    instanceId: 'instance-1',
    address: { chatId: 'chat-1' },
    payload: { text: '已收到' },
    idempotencyKey: 'reply:thread-1:1',
    now: AT,
  });
}

describe('OutboundMessage 聚合', () => {
  it('创建后为待发且立即到期', () => {
    const message = createMessage();
    expect(message.status).toBe('pending');
    expect(message.isDue(AT)).toBe(true);
  });

  it('发送成功后不再到期', () => {
    const message = createMessage();
    message.markSent(LATER);
    expect(message.status).toBe('sent');
    expect(message.sentAt).toEqual(LATER);
    expect(message.isDue(LATER)).toBe(false);
  });

  it('可重试失败记录次数与下次时间', () => {
    const message = createMessage();
    message.markFailure('timeout', LATER, AT);
    expect(message.attempts).toBe(1);
    expect(message.nextAttemptAt).toEqual(LATER);
    expect(message.isDue(AT)).toBe(false);
  });

  it('永久失败后不再重试', () => {
    const message = createMessage();
    message.markGone('chat deleted', LATER);
    expect(message.status).toBe('gone');
    expect(message.isDue(LATER)).toBe(false);
  });

  it('快照可重建等价聚合', () => {
    const message = createMessage();
    message.markSent(LATER);
    const restored = OutboundMessage.rehydrate(message.toSnapshot());
    expect(restored.toSnapshot()).toEqual(message.toSnapshot());
  });
});
