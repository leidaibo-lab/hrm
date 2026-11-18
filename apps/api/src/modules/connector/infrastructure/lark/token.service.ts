import { Injectable } from '@nestjs/common';
import { env } from '../../../../config/env';
import { HttpService } from '../../../../platform/http';
import { PermanentOutboundError } from '../../domain/outbound-transport.port';

/** 租户 token 地址。 */
const tokenUrl = (): string =>
  `${env.LARK_API_BASE}/open-apis/auth/v3/tenant_access_token/internal`;

/** 飞书 token 响应。 */
interface LarkTokenResponse {
  /** 业务码，0 为成功。 */
  code: number;
  /** 错误信息。 */
  msg: string;
  /** 租户 token。 */
  tenant_access_token?: string;
  /** 有效期（秒）。 */
  expire?: number;
}

/** 飞书租户 token：进程内缓存，提前 60 秒刷新。 */
@Injectable()
export class LarkTokenService {
  #token: string | null = null;
  #expiresAt = 0;

  constructor(private readonly http: HttpService) {}

  /** 取有效 token；未配置凭据时报错。 */
  async getToken(): Promise<string> {
    if (this.#token && Date.now() < this.#expiresAt) return this.#token;
    if (!env.LARK_APP_ID || !env.LARK_APP_SECRET)
      throw new PermanentOutboundError('飞书应用凭据未配置');

    const response = await this.http.postJson<LarkTokenResponse>(tokenUrl(), {
      app_id: env.LARK_APP_ID,
      app_secret: env.LARK_APP_SECRET,
    });
    if (response.code !== 0 || !response.tenant_access_token)
      throw new Error(`飞书 token 获取失败：${response.msg || response.code}`);

    const token = response.tenant_access_token;
    this.#token = token;
    this.#expiresAt =
      Date.now() + Math.max((response.expire ?? 0) - 60, 0) * 1000;
    return token;
  }
}
