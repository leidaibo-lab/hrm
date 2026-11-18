import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  type ReplyTarget,
  type ScopeResult,
  SourceAdapter,
  type SourceType,
  type TriggerEnvelope,
} from '../../domain/source-adapter.port';

/** 飞书来源配置：接收的群、接收模式与机器人标识。 */
export const LarkConfigSchema = z
  .object({
    chats: z.array(z.string().min(1)).default([]),
    tables: z
      .array(
        z.object({
          appToken: z.string().min(1),
          tableId: z.string().min(1),
        }),
      )
      .default([]),
    listen: z.enum(['mentions', 'all']).default('mentions'),
    // 机器人 open_id 必填：缺少时既无法过滤自身消息，也无法识别 @ 机器人。
    botId: z.string().min(1),
  })
  .strict();

/** 飞书来源配置类型。 */
export type LarkConfig = z.infer<typeof LarkConfigSchema>;

/** 扁平消息结构：测试与内部归一化使用。 */
const LarkMessageSchema = z
  .object({
    message_id: z.string().min(1),
    chat_id: z.string().min(1),
    thread_id: z.string().optional(),
    chat_type: z.string().optional(),
    sender_id: z.string().min(1),
    text: z.string().default(''),
    mentions_me: z.boolean().default(false),
    create_time: z.union([z.string(), z.number()]).optional(),
    app_token: z.string().optional(),
    table_id: z.string().optional(),
    record_id: z.string().optional(),
  })
  .passthrough();

/** 飞书事件回调结构（v2）：消息与发送者嵌套。 */
const LarkCallbackEventSchema = z
  .object({
    message: z
      .object({
        message_id: z.string().min(1),
        chat_id: z.string().min(1),
        thread_id: z.string().optional(),
        chat_type: z.string().optional(),
        create_time: z.union([z.string(), z.number()]).optional(),
        content: z.string().optional(),
        mentions: z
          .array(
            z
              .object({
                id: z.object({ open_id: z.string() }).passthrough(),
              })
              .passthrough(),
          )
          .optional(),
      })
      .passthrough(),
    sender: z
      .object({
        sender_id: z.object({ open_id: z.string().min(1) }).passthrough(),
      })
      .passthrough(),
  })
  .passthrough();

/** 从飞书 content JSON 中取文本；非 JSON 原样返回。 */
function extractText(content: string | undefined): string {
  if (!content) return '';
  try {
    const parsed = JSON.parse(content) as { text?: unknown };
    return typeof parsed.text === 'string' ? parsed.text : '';
  } catch {
    return content;
  }
}

/** 毫秒时间戳转日期；无效值回退当前时间。 */
function toDate(value: string | number | undefined): Date {
  if (value === undefined) return new Date();
  const date = new Date(Number(value));
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

/** 飞书来源适配器：消息事件（扁平或回调嵌套）→ 事件信封。 */
@Injectable()
export class LarkSource extends SourceAdapter<LarkConfig> {
  readonly type: SourceType = 'lark';
  readonly schema = LarkConfigSchema;

  /** 原始消息 → 信封；自身消息、无效结构与空消息返回 undefined。 */
  translate(raw: unknown, config: LarkConfig): TriggerEnvelope | undefined {
    const flat = LarkMessageSchema.safeParse(raw);
    if (flat.success) {
      const event = flat.data;
      return this.envelope(
        {
          messageId: event.message_id,
          chatId: event.chat_id,
          threadId: event.thread_id,
          chatType: event.chat_type,
          senderId: event.sender_id,
          text: event.text,
          mentioned: event.mentions_me,
          occurredAt: toDate(event.create_time),
          appToken: event.app_token,
          tableId: event.table_id,
          recordId: event.record_id,
        },
        config,
      );
    }

    const callback = LarkCallbackEventSchema.safeParse(raw);
    if (!callback.success) return undefined;
    const event = callback.data;
    const mentioned = Boolean(
      config.botId &&
        event.message.mentions?.some(
          (mention) => mention.id.open_id === config.botId,
        ),
    );
    return this.envelope(
      {
        messageId: event.message.message_id,
        chatId: event.message.chat_id,
        threadId: event.message.thread_id,
        chatType: event.message.chat_type,
        senderId: event.sender.sender_id.open_id,
        text: extractText(event.message.content),
        mentioned,
        occurredAt: toDate(event.message.create_time),
      },
      config,
    );
  }

  /** 范围判定：群在白名单内，且按接收模式判断是否点名；私聊直接放行。 */
  scope(envelope: TriggerEnvelope, config: LarkConfig): ScopeResult {
    const payload = envelope.payload as {
      table_id?: unknown;
    };
    if (typeof payload.table_id === 'string') {
      const table = config.tables.some(
        (item) => item.tableId === payload.table_id,
      );
      return table
        ? { listened: true, row: payload.table_id }
        : {
            listened: false,
            row: payload.table_id,
            reason: 'table_not_listed',
          };
    }

    const chatId = envelope.scopeKey;
    if (!chatId || !config.chats.includes(chatId))
      return { listened: false, row: chatId, reason: 'chat_not_listed' };
    if (
      config.listen === 'mentions' &&
      envelope.addressed !== 'mention' &&
      envelope.addressed !== 'direct'
    )
      return { listened: false, row: chatId, reason: 'mention_required' };
    return { listened: true, row: chatId };
  }

  /** 出站地址：群与消息。 */
  replyTarget(envelope: TriggerEnvelope): ReplyTarget {
    const payload = envelope.payload as { chat_id: string; message_id: string };
    return {
      addressKey: payload.chat_id,
      address: {
        chatId: payload.chat_id,
        messageId: payload.message_id,
      },
    };
  }

  private envelope(
    fields: {
      messageId: string;
      chatId: string;
      threadId?: string;
      chatType?: string;
      senderId: string;
      text: string;
      mentioned: boolean;
      occurredAt: Date;
      appToken?: string;
      tableId?: string;
      recordId?: string;
    },
    config: LarkConfig,
  ): TriggerEnvelope | undefined {
    if (config.botId && fields.senderId === config.botId) return undefined;
    if (!fields.text.trim()) return undefined;
    let addressed: TriggerEnvelope['addressed'] = null;
    if (fields.mentioned) addressed = 'mention';
    else if (fields.chatType === 'p2p') addressed = 'direct';

    return {
      dedupeKey: `lark:${fields.messageId}`,
      sourceType: this.type,
      threadKey: `lark:${fields.chatId}:${fields.threadId ?? fields.messageId}`,
      scopeKey: fields.chatId,
      actorId: fields.senderId,
      text: fields.text,
      payload: {
        message_id: fields.messageId,
        chat_id: fields.chatId,
        thread_id: fields.threadId,
        chat_type: fields.chatType,
        sender_id: fields.senderId,
        mentions_me: fields.mentioned,
        create_time: fields.occurredAt.getTime(),
        ...(fields.appToken ? { app_token: fields.appToken } : {}),
        ...(fields.tableId ? { table_id: fields.tableId } : {}),
        ...(fields.recordId ? { record_id: fields.recordId } : {}),
      },
      occurredAt: fields.occurredAt,
      addressed,
    };
  }
}
