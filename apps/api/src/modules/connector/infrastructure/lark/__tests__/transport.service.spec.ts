import { afterEach, describe, expect, it } from 'vitest';
import { env } from '../../../../../config/env';
import { HttpError } from '../../../../../platform/http';
import { PermanentOutboundError } from '../../../domain/outbound-transport.port';
import { LarkTokenService } from '../token.service';
import { LarkOutboundTransport } from '../transport.service';

interface Call {
  url: string;
  body: unknown;
  options?: { headers?: Record<string, string> };
}

type Action = { response: unknown } | { error: Error };

class FakeHttpService {
  readonly calls: Call[] = [];
  readonly queue: Action[] = [];

  async postJson(
    url: string,
    body: unknown,
    options?: { headers?: Record<string, string> },
  ): Promise<unknown> {
    return this.respond(url, body, options);
  }

  async putJson(
    url: string,
    body: unknown,
    options?: { headers?: Record<string, string> },
  ): Promise<unknown> {
    return this.respond(url, body, options);
  }

  private respond(
    url: string,
    body: unknown,
    options?: { headers?: Record<string, string> },
  ): unknown {
    this.calls.push({ url, body, options });
    const action = this.queue.shift();
    if (!action) throw new Error('缺少 fake 响应');
    if ('error' in action) throw action.error;
    return action.response;
  }
}

const original = {
  appId: env.LARK_APP_ID,
  secret: env.LARK_APP_SECRET,
};

afterEach(() => {
  env.LARK_APP_ID = original.appId;
  env.LARK_APP_SECRET = original.secret;
});

function makeTransport(): {
  transport: LarkOutboundTransport;
  http: FakeHttpService;
} {
  env.LARK_APP_ID = 'app-id';
  env.LARK_APP_SECRET = 'app-secret';
  const http = new FakeHttpService();
  return {
    transport: new LarkOutboundTransport(
      http as never,
      new LarkTokenService(http as never),
    ),
    http,
  };
}

const input = {
  address: { chatId: 'chat-1' },
  payload: { text: '已收到' },
};

describe('LarkOutboundTransport', () => {
  it('先取 token 再发送文本消息', async () => {
    const { transport, http } = makeTransport();
    http.queue.push(
      {
        response: {
          code: 0,
          msg: 'ok',
          tenant_access_token: 'token-1',
          expire: 7200,
        },
      },
      { response: { code: 0, msg: 'ok' } },
    );

    await transport.send(input);

    expect(http.calls).toHaveLength(2);
    expect(http.calls[0].body).toEqual({
      app_id: 'app-id',
      app_secret: 'app-secret',
    });
    expect(http.calls[1].body).toEqual({
      receive_id: 'chat-1',
      msg_type: 'text',
      content: JSON.stringify({ text: '已收到' }),
    });
    expect(http.calls[1].options?.headers?.authorization).toBe(
      'Bearer token-1',
    );
  });

  it('token 在有效期内复用', async () => {
    const { transport, http } = makeTransport();
    http.queue.push(
      {
        response: {
          code: 0,
          msg: 'ok',
          tenant_access_token: 'token-1',
          expire: 7200,
        },
      },
      { response: { code: 0, msg: 'ok' } },
      { response: { code: 0, msg: 'ok' } },
    );

    await transport.send(input);
    await transport.send(input);

    expect(http.calls).toHaveLength(3);
  });

  it('字段写回调用 Bitable 更新接口', async () => {
    const { transport, http } = makeTransport();
    http.queue.push(
      {
        response: {
          code: 0,
          msg: 'ok',
          tenant_access_token: 'token-1',
          expire: 7200,
        },
      },
      { response: { code: 0, msg: 'ok' } },
    );

    await transport.send({
      address: { appToken: 'app', tableId: 'table', recordId: 'record' },
      payload: { kind: 'fields', fields: { title: '导出' } },
    });

    expect(http.calls[1].url).toContain(
      '/bitable/v1/apps/app/tables/table/records/record',
    );
    expect(http.calls[1].body).toEqual({ fields: { title: '导出' } });
  });

  it('缺少应用凭据为永久失败', async () => {
    env.LARK_APP_ID = '';
    env.LARK_APP_SECRET = '';
    const http = new FakeHttpService();
    const transport = new LarkOutboundTransport(
      http as never,
      new LarkTokenService(http as never),
    );
    await expect(transport.send(input)).rejects.toThrow(PermanentOutboundError);
  });

  it('4xx 发送失败为永久失败', async () => {
    const { transport, http } = makeTransport();
    http.queue.push(
      {
        response: {
          code: 0,
          msg: 'ok',
          tenant_access_token: 'token-1',
          expire: 7200,
        },
      },
      { error: new HttpError(400, 'bad request', '飞书返回 400') },
    );

    await expect(transport.send(input)).rejects.toThrow(PermanentOutboundError);
  });
});
