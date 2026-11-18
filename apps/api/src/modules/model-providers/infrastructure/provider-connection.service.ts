import { Injectable } from '@nestjs/common';
import { CryptoService } from '../../../platform/crypto';
import { HttpError, HttpService } from '../../../platform/http';
import type { ModelProvider } from '../domain/model-provider.entity';
import type {
  ProviderConnectionPort,
  ProviderConnectionResult,
} from '../domain/provider-connection.port';

/** OpenAI 兼容供应商探测；协议、凭据解密和上游错误收口于此。 */
@Injectable()
export class ProviderConnectionService implements ProviderConnectionPort {
  constructor(
    private readonly http: HttpService,
    private readonly crypto: CryptoService,
  ) {}

  async probe(provider: ModelProvider): Promise<ProviderConnectionResult> {
    const startedAt = Date.now();
    try {
      const body = await this.http.getJson<{ data?: unknown[] }>(
        `${provider.baseUrl.replace(/\/$/, '')}/models`,
        {
          headers: {
            authorization: `Bearer ${this.crypto.decrypt(provider.apiKeyCipher)}`,
          },
          timeoutMs: 5000,
        },
      );
      return {
        ok: true,
        modelCount: Array.isArray(body?.data) ? body.data.length : 0,
        latencyMs: Date.now() - startedAt,
      };
    } catch (cause) {
      let error = String(cause);
      if (cause instanceof HttpError) {
        error = `上游 HTTP ${cause.status}${cause.body ? `: ${cause.body.slice(0, 300)}` : ''}`;
      } else if (cause instanceof Error) {
        error = cause.message;
      }
      return { ok: false, latencyMs: Date.now() - startedAt, error };
    }
  }
}
