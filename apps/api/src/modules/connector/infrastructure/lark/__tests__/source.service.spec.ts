import { describe, expect, it } from 'vitest';
import type { TriggerEnvelope } from '../../../domain/source-adapter.port';
import { LarkSource } from '../source.service';

const source = new LarkSource();
const config = source.validateConfig({
  chats: ['chat-1'],
  listen: 'mentions',
  botId: 'bot-1',
});

const raw = {
  message_id: 'message-1',
  chat_id: 'chat-1',
  thread_id: 'thread-1',
  sender_id: 'user-1',
  text: '@agentic 补充验收标准',
  mentions_me: true,
  create_time: '1794758400000',
};

function translate(rawEvent: unknown = raw): TriggerEnvelope {
  const envelope = source.translate(rawEvent, config);
  if (!envelope) throw new Error('fixture 翻译失败');
  return envelope;
}

describe('LarkSource.translate', () => {
  it('把消息翻译为事件信封', () => {
    const envelope = translate();
    expect(envelope.dedupeKey).toBe('lark:message-1');
    expect(envelope.threadKey).toBe('lark:chat-1:thread-1');
    expect(envelope.scopeKey).toBe('chat-1');
    expect(envelope.addressed).toBe('mention');
    expect(envelope.occurredAt.toISOString()).toBe('2026-11-15T16:00:00.000Z');
  });

  it('过滤机器人自己的消息', () => {
    expect(
      source.translate({ ...raw, sender_id: 'bot-1' }, config),
    ).toBeUndefined();
  });

  it('过滤空文本与无效结构', () => {
    expect(source.translate({ ...raw, text: '  ' }, config)).toBeUndefined();
    expect(source.translate({ message_id: 'x' }, config)).toBeUndefined();
  });
});

describe('LarkSource.translate 回调', () => {
  it('解析嵌套回调与 content JSON', () => {
    const envelope = source.translate(
      {
        message: {
          message_id: 'message-2',
          chat_id: 'chat-1',
          thread_id: 'thread-2',
          content: JSON.stringify({ text: '补充需求' }),
          mentions: [{ id: { open_id: 'bot-1' } }],
        },
        sender: { sender_id: { open_id: 'user-2' } },
      },
      config,
    );
    expect(envelope?.text).toBe('补充需求');
    expect(envelope?.addressed).toBe('mention');
    expect(envelope?.threadKey).toBe('lark:chat-1:thread-2');
  });

  it('私聊消息视为 direct', () => {
    const envelope = source.translate(
      {
        message: {
          message_id: 'message-3',
          chat_id: 'chat-1',
          chat_type: 'p2p',
          content: JSON.stringify({ text: '私聊需求' }),
        },
        sender: { sender_id: { open_id: 'user-3' } },
      },
      config,
    );
    expect(envelope?.addressed).toBe('direct');
  });
});

describe('LarkSource.scope', () => {
  it('群不在白名单时拒绝', () => {
    const result = source.scope({ ...translate(), scopeKey: 'chat-2' }, config);
    expect(result.listened).toBe(false);
    expect(result.reason).toBe('chat_not_listed');
  });

  it('mentions 模式要求点名', () => {
    const result = source.scope({ ...translate(), addressed: null }, config);
    expect(result.listened).toBe(false);
    expect(result.reason).toBe('mention_required');
  });

  it('表格记录按 tables 白名单放行', () => {
    const tableConfig = source.validateConfig({
      tables: [{ appToken: 'app', tableId: 'table' }],
      botId: 'bot-1',
    });
    const envelope = translate({
      ...raw,
      app_token: 'app',
      table_id: 'table',
      record_id: 'record-1',
    });
    expect(source.scope(envelope, tableConfig).listened).toBe(true);
  });

  it('表格不在白名单时拒绝', () => {
    const tableConfig = source.validateConfig({
      tables: [{ appToken: 'app', tableId: 'table' }],
      botId: 'bot-1',
    });
    const envelope = translate({
      ...raw,
      app_token: 'app',
      table_id: 'other',
      record_id: 'record-1',
    });
    expect(source.scope(envelope, tableConfig).reason).toBe('table_not_listed');
  });

  it('all 模式接受未点名消息', () => {
    const all = source.validateConfig({
      chats: ['chat-1'],
      listen: 'all',
      botId: 'bot-1',
    });
    const result = source.scope({ ...translate(), addressed: null }, all);
    expect(result.listened).toBe(true);
  });
});

describe('LarkSource.replyTarget', () => {
  it('定位到群与消息', () => {
    expect(source.replyTarget(translate())).toEqual({
      addressKey: 'chat-1',
      address: { chatId: 'chat-1', messageId: 'message-1' },
    });
  });
});

describe('LarkSource.validateConfig', () => {
  it('缺少 botId 时拒绝配置', () => {
    expect(() => source.validateConfig({ chats: ['chat-1'] })).toThrow();
  });
});
