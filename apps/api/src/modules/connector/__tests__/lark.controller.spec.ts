import { createCipheriv, createHash } from 'node:crypto';
import { ForbiddenException } from '@nestjs/common';
import { afterEach, describe, expect, it } from 'vitest';
import { env } from '../../../config/env';
import type { RedisService } from '../../../platform/redis';
import { IngressService } from '../application/ingress.service';
import { LarkController } from '../lark.controller';

class FakeIngressService {
  calls = 0;
  last: { instanceId: string; raw: unknown } | null = null;
  result: unknown = { accepted: true, triggerId: 'trigger-1', created: true };

  async accept(input: { instanceId: string; raw: unknown }): Promise<unknown> {
    this.calls += 1;
    this.last = input;
    return this.result;
  }
}

const originalToken = env.LARK_VERIFICATION_TOKEN;
const originalEncryptKey = env.LARK_ENCRYPT_KEY;
const request = { headers: {}, rawBody: Buffer.from('{}') };

afterEach(() => {
  env.LARK_VERIFICATION_TOKEN = originalToken;
  env.LARK_ENCRYPT_KEY = originalEncryptKey;
});

class FakeRedis {
  private calls = 0;
  async withClient<T>(
    fn: (client: { set: () => Promise<string | null> }) => Promise<T>,
  ): Promise<T> {
    return fn({
      set: async () => {
        this.calls += 1;
        return this.calls === 1 ? 'OK' : null;
      },
    });
  }
}

function makeController(): {
  controller: LarkController;
  ingress: FakeIngressService;
} {
  const ingress = new FakeIngressService();
  return {
    controller: new LarkController(
      ingress as unknown as IngressService,
      new FakeRedis() as unknown as RedisService,
    ),
    ingress,
  };
}

describe('LarkController.receive', () => {
  it('url_verification 直接回 challenge', async () => {
    const { controller, ingress } = makeController();
    const response = await controller.receive(
      'instance-1',
      {
        type: 'url_verification',
        challenge: 'challenge-1',
      },
      request,
    );
    expect(response).toEqual({ challenge: 'challenge-1' });
    expect(ingress.calls).toBe(0);
  });

  it('事件回调交给接入服务', async () => {
    const { controller, ingress } = makeController();
    const event = { message_id: 'message-1' };
    const response = await controller.receive(
      'instance-1',
      {
        header: { event_type: 'im.message.receive_v1' },
        event,
      },
      request,
    );
    expect(response).toEqual({ code: 0 });
    expect(ingress.last).toEqual({
      instanceId: 'instance-1',
      raw: event,
      deferRouting: true,
    });
  });

  it('超出接收配额时返回 429 交由飞书重试', async () => {
    const { controller, ingress } = makeController();
    ingress.result = { accepted: false, reason: 'rate_limited' };

    await expect(
      controller.receive(
        'instance-1',
        {
          header: { event_type: 'im.message.receive_v1' },
          event: { message_id: 'message-2' },
        },
        request,
      ),
    ).rejects.toMatchObject({ status: 429 });
  });

  it('配置加密密钥后校验签名', async () => {
    env.LARK_ENCRYPT_KEY = 'encrypt-key';
    const { controller, ingress } = makeController();
    const body = { event: { message_id: 'm1' } };
    const raw = JSON.stringify(body);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHash('sha256')
      .update(`${timestamp}nencrypt-key${raw}`)
      .digest('hex');
    const response = await controller.receive('instance-1', body, {
      rawBody: Buffer.from(raw),
      headers: {
        'x-lark-request-timestamp': timestamp,
        'x-lark-request-nonce': 'n',
        'x-lark-signature': signature,
      },
    });
    expect(response).toEqual({ code: 0 });
    expect(ingress.calls).toBe(1);
  });

  it('解密加密事件后交给接入服务', async () => {
    env.LARK_ENCRYPT_KEY = 'encrypt-key';
    const { controller, ingress } = makeController();
    const plain = JSON.stringify({ event: { message_id: 'm2' } });
    const key = createHash('sha256').update('encrypt-key').digest();
    const iv = Buffer.alloc(16, 2);
    const cipher = createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([
      iv,
      cipher.update(plain, 'utf8'),
      cipher.final(),
    ]).toString('base64');
    const raw = JSON.stringify({ encrypt: encrypted });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHash('sha256')
      .update(`${timestamp}nencrypt-key${raw}`)
      .digest('hex');

    const response = await controller.receive(
      'instance-1',
      { encrypt: encrypted },
      {
        rawBody: Buffer.from(raw),
        headers: {
          'x-lark-request-timestamp': timestamp,
          'x-lark-request-nonce': 'n',
          'x-lark-signature': signature,
        },
      },
    );
    expect(response).toEqual({ code: 0 });
    expect(ingress.last?.raw).toEqual({ message_id: 'm2' });
  });

  it('重复 nonce 拒绝', async () => {
    env.LARK_ENCRYPT_KEY = 'encrypt-key';
    const { controller } = makeController();
    const raw = JSON.stringify({ event: {} });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHash('sha256')
      .update(`${timestamp}nencrypt-key${raw}`)
      .digest('hex');
    const request = {
      rawBody: Buffer.from(raw),
      headers: {
        'x-lark-request-timestamp': timestamp,
        'x-lark-request-nonce': 'n',
        'x-lark-signature': signature,
      },
    };

    await controller.receive('instance-1', { event: {} }, request);
    await expect(
      controller.receive('instance-1', { event: {} }, request),
    ).rejects.toThrow('飞书请求重复');
  });

  it('时间戳超出窗口时拒绝', async () => {
    env.LARK_ENCRYPT_KEY = 'encrypt-key';
    const { controller } = makeController();
    await expect(
      controller.receive(
        'instance-1',
        { event: {} },
        {
          rawBody: Buffer.from('{}'),
          headers: {
            'x-lark-request-timestamp': '1',
            'x-lark-request-nonce': 'n',
            'x-lark-signature': 'bad',
          },
        },
      ),
    ).rejects.toThrow('时间戳超出窗口');
  });

  it('签名不匹配时拒绝', async () => {
    env.LARK_ENCRYPT_KEY = 'encrypt-key';
    const { controller } = makeController();
    await expect(
      controller.receive(
        'instance-1',
        { event: {} },
        {
          rawBody: Buffer.from('{}'),
          headers: {
            'x-lark-request-timestamp': '1',
            'x-lark-request-nonce': 'n',
            'x-lark-signature': 'bad',
          },
        },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('配置 token 后拒绝不匹配的回调', async () => {
    env.LARK_VERIFICATION_TOKEN = 'secret';
    const { controller } = makeController();
    await expect(
      controller.receive(
        'instance-1',
        {
          header: { token: 'wrong' },
          event: {},
        },
        request,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('配置 token 后接受匹配的回调', async () => {
    env.LARK_VERIFICATION_TOKEN = 'secret';
    const { controller, ingress } = makeController();
    const response = await controller.receive(
      'instance-1',
      {
        token: 'secret',
        event: {},
      },
      request,
    );
    expect(response).toEqual({ code: 0 });
    expect(ingress.calls).toBe(1);
  });
});
