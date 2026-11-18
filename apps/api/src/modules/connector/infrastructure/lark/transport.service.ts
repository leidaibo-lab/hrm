import { Injectable } from '@nestjs/common';
import { env } from '../../../../config/env';
import { HttpError, HttpService } from '../../../../platform/http';
import {
  type OutboundSendInput,
  type OutboundTransport,
  PermanentOutboundError,
} from '../../domain/outbound-transport.port';
import type { SourceType } from '../../domain/source-adapter.port';
import { LarkTokenService } from './token.service';

/** 发送消息地址。 */
const messageUrl = (): string =>
  `${env.LARK_API_BASE}/open-apis/im/v1/messages?receive_id_type=chat_id`;

/**
 * 飞书出站传输：文本消息或多维表格字段写回。
 * 4xx（429 除外）视为永久失败，其余错误交给上层退避重试。
 */
@Injectable()
export class LarkOutboundTransport implements OutboundTransport {
  readonly type: SourceType = 'lark';

  constructor(
    private readonly http: HttpService,
    private readonly tokens: LarkTokenService,
  ) {}

  /** 发送文本消息或写回多维表格字段。 */
  async send(input: OutboundSendInput): Promise<void> {
    const payload = input.payload as {
      kind?: unknown;
      text?: unknown;
      fields?: unknown;
    };
    if (payload.kind === 'fields')
      return this.writeFields(input.address, payload.fields);

    const chatId = (input.address as { chatId?: unknown }).chatId;
    const text = payload.text;
    if (typeof chatId !== 'string' || !chatId)
      throw new PermanentOutboundError('飞书出站地址缺少 chatId');
    if (typeof text !== 'string' || !text)
      throw new PermanentOutboundError('飞书出站消息缺少 text');

    const token = await this.tokens.getToken();
    try {
      await this.http.postJson(
        messageUrl(),
        {
          receive_id: chatId,
          msg_type: 'text',
          content: JSON.stringify({ text }),
        },
        { headers: { authorization: `Bearer ${token}` } },
      );
    } catch (error) {
      if (
        error instanceof HttpError &&
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 429
      )
        throw new PermanentOutboundError(`飞书发送失败：${error.message}`);
      throw error;
    }
  }

  private async writeFields(address: unknown, fields: unknown): Promise<void> {
    const target = address as {
      appToken?: unknown;
      tableId?: unknown;
      recordId?: unknown;
    };
    if (
      typeof target.appToken !== 'string' ||
      typeof target.tableId !== 'string' ||
      typeof target.recordId !== 'string'
    )
      throw new PermanentOutboundError('飞书字段写回地址不完整');
    if (!fields || typeof fields !== 'object')
      throw new PermanentOutboundError('飞书字段写回缺少 fields');

    const token = await this.tokens.getToken();
    const url = `${env.LARK_API_BASE}/open-apis/bitable/v1/apps/${encodeURIComponent(
      target.appToken,
    )}/tables/${encodeURIComponent(target.tableId)}/records/${encodeURIComponent(
      target.recordId,
    )}`;
    const response = await this.http.putJson<{ code?: number; msg?: string }>(
      url,
      { fields },
      { headers: { authorization: `Bearer ${token}` } },
    );
    if (response.code !== undefined && response.code !== 0)
      throw new PermanentOutboundError(
        `飞书字段写回失败：${response.msg ?? response.code}`,
      );
  }
}
