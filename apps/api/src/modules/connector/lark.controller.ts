import { createDecipheriv, createHash, timingSafeEqual } from 'node:crypto';
import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpException,
  Logger,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { env } from '../../config/env';
import { Public } from '../../pipeline/guards';
import { ZodValidationPipe } from '../../pipeline/pipes';
import { RedisService } from '../../platform/redis';
import { IngressService } from './application/ingress.service';

import {
  type LarkCallback,
  type LarkEvent,
  larkCallbackSchema,
  larkEventSchema,
} from './dto/lark-callback.dto';

/** 飞书回调响应：challenge 或确认码。 */
type LarkCallbackResponse = { challenge: string } | { code: number };

/**
 * 飞书事件回调入口：公开路由，按实例路由到适配器。
 * 校验 token 只从环境变量读取；事件处理失败不回滚已接收事件。
 */
@ApiTags('connector')
@Controller('connector/lark')
@Public()
export class LarkController {
  private readonly logger = new Logger(LarkController.name);

  constructor(
    private readonly ingress: IngressService,
    private readonly redis: RedisService,
  ) {}

  /** 接收飞书回调；url_verification 直接回 challenge。 */
  @Post(':instanceId/events')
  @HttpCode(200)
  @ApiOperation({ summary: '飞书事件回调' })
  @ApiOkResponse({ description: 'challenge 或 { code: 0 }' })
  async receive(
    @Param('instanceId') instanceId: string,
    @Body(new ZodValidationPipe(larkCallbackSchema)) body: LarkCallback,
    @Req() request: { rawBody?: Buffer; headers: Record<string, unknown> },
  ): Promise<LarkCallbackResponse> {
    await this.verifySignature(body, request);
    const event = this.resolveEvent(body);
    this.verifyToken(event);

    if (event.type === 'url_verification' && event.challenge)
      return { challenge: event.challenge };

    // 回调只做验签/翻译/落库并入队，立即 ACK；研判在 worker 内异步执行。
    const result = await this.ingress.accept({
      instanceId,
      deferRouting: true,
      raw: event.event ?? event,
    });
    if (!result.accepted && result.reason === 'rate_limited') {
      // 超出来源每秒配额：返回 429 让飞书退避重试，事件不丢。
      throw new HttpException(
        { code: 'ingress.rate_limited', message: '事件接收过于频繁，请重试' },
        429,
      );
    }
    return { code: 0 };
  }

  private async verifySignature(
    body: LarkCallback,
    request: { rawBody?: Buffer; headers: Record<string, unknown> },
  ): Promise<void> {
    const encryptKey = env.LARK_ENCRYPT_KEY;
    if (!encryptKey) {
      if ('encrypt' in body) throw new ForbiddenException('未配置飞书加密密钥');
      return;
    }
    const timestamp = request.headers['x-lark-request-timestamp'];
    const nonce = request.headers['x-lark-request-nonce'];
    const signature = request.headers['x-lark-signature'];
    if (
      typeof timestamp !== 'string' ||
      typeof nonce !== 'string' ||
      typeof signature !== 'string' ||
      !request.rawBody
    )
      throw new ForbiddenException('飞书签名头缺失');

    const timestampSeconds = Number(timestamp);
    if (
      !Number.isFinite(timestampSeconds) ||
      Math.abs(Date.now() / 1000 - timestampSeconds) > 300
    )
      throw new ForbiddenException('飞书签名时间戳超出窗口');

    const rawBody = request.rawBody.toString('utf8');
    const expected = createHash('sha256')
      .update(timestamp + nonce + encryptKey + rawBody)
      .digest('hex');
    const left = Buffer.from(expected);
    const right = Buffer.from(signature);
    if (left.length !== right.length || !timingSafeEqual(left, right))
      throw new ForbiddenException('飞书签名校验失败');
    await this.claimNonce(nonce);
  }

  private async claimNonce(nonce: string): Promise<void> {
    try {
      const claimed = await this.redis.withClient((client) =>
        client.set(`lark:nonce:${nonce}`, '1', 'PX', 300_000, 'NX'),
      );
      if (claimed === null) throw new ForbiddenException('飞书请求重复');
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      this.logger.warn(
        `飞书 nonce 去重不可用：${
          error instanceof Error ? error.message : '未知错误'
        }`,
      );
    }
  }

  private resolveEvent(body: LarkCallback): LarkEvent {
    if ('encrypt' in body && typeof body.encrypt === 'string') {
      const encryptKey = env.LARK_ENCRYPT_KEY;
      if (!encryptKey) throw new ForbiddenException('未配置飞书加密密钥');
      const key = createHash('sha256').update(encryptKey).digest();
      const buffer = Buffer.from(body.encrypt, 'base64');
      if (buffer.length <= 16)
        throw new ForbiddenException('飞书加密事件体格式错误');
      const decipher = createDecipheriv(
        'aes-256-cbc',
        key,
        buffer.subarray(0, 16),
      );
      const plain = Buffer.concat([
        decipher.update(buffer.subarray(16)),
        decipher.final(),
      ]).toString('utf8');
      return larkEventSchema.parse(JSON.parse(plain));
    }
    return body;
  }

  private verifyToken(body: LarkEvent): void {
    if (!env.LARK_VERIFICATION_TOKEN) return;
    const token = body.header?.token ?? body.token;
    if (token !== env.LARK_VERIFICATION_TOKEN)
      throw new ForbiddenException('飞书校验 token 不匹配');
  }
}
