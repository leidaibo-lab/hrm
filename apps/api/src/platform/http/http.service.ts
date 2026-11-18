import { Injectable } from '@nestjs/common';
import {
  assertOutboundUrl,
  OutboundUrlViolationError,
} from './outbound-policy';

const DEFAULT_TIMEOUT_MS = 10_000;
const ERROR_BODY_MAX_LENGTH = 2048;
const MAX_REDIRECTS = 3;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** 上游返回非 2xx：status 为状态码，body 为截断后的响应体（供连通性测试展示上游错误）。 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: string | undefined,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/** 请求超时、网络不可达或出站地址违反策略。 */
export class HttpUnreachableError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'HttpUnreachableError';
  }
}

/** JSON 请求选项：请求头透传，超时覆盖默认值。 */
export interface HttpJsonOptions {
  /** 随请求发送的头；授权头由调用方注入，错误信息不含头内容。 */
  headers?: Record<string, string>;
  /** 请求超时毫秒数（每一跳独立计时），默认 10s（连通性测试 5s、目录拉取 10s）。 */
  timeoutMs?: number;
}

/**
 * HTTP 客户端适配器（ADR-0015）：原生 fetch 薄封装，零第三方依赖。
 * 职责收敛为出站策略、超时、错误归一、JSON 解析；不做拦截器与重试。
 * 供模型目录（models.dev）拉取与供应商连通性测试消费。
 */
@Injectable()
export class HttpService {
  async getJson<T>(url: string, options?: HttpJsonOptions): Promise<T> {
    return this.requestJson<T>('GET', url, undefined, options);
  }

  async postJson<T>(
    url: string,
    body: unknown,
    options?: HttpJsonOptions,
  ): Promise<T> {
    return this.requestJson<T>('POST', url, body, options);
  }

  async putJson<T>(
    url: string,
    body: unknown,
    options?: HttpJsonOptions,
  ): Promise<T> {
    return this.requestJson<T>('PUT', url, body, options);
  }

  private async requestJson<T>(
    method: 'GET' | 'POST' | 'PUT',
    url: string,
    body: unknown,
    options?: HttpJsonOptions,
  ): Promise<T> {
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    let response: Response;
    let currentUrl = url;
    try {
      // 出站策略（ADR-0038）：初始地址与每一跳重定向都过同一策略；手动跟跳防止 fetch 自动跟随绕过校验
      assertOutboundUrl(currentUrl);
      let hops = 0;
      for (;;) {
        response = await fetch(currentUrl, {
          method,
          headers: {
            accept: 'application/json',
            ...(body === undefined || method === 'GET'
              ? {}
              : { 'content-type': 'application/json' }),
            ...options?.headers,
          },
          body: method === 'GET' ? undefined : JSON.stringify(body),
          redirect: 'manual',
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!REDIRECT_STATUSES.has(response.status)) break;
        const location = response.headers.get('location');
        if (!location) {
          throw new HttpError(
            response.status,
            undefined,
            `${method} ${redact(currentUrl)} → HTTP ${response.status} 缺少 location`,
          );
        }
        hops += 1;
        if (hops > MAX_REDIRECTS) {
          throw new HttpError(
            508,
            undefined,
            `${method} ${redact(url)} 重定向超过 ${MAX_REDIRECTS} 跳`,
          );
        }
        currentUrl = new URL(location, currentUrl).toString();
        assertOutboundUrl(currentUrl);
      }
    } catch (cause) {
      if (
        cause instanceof HttpError ||
        cause instanceof OutboundUrlViolationError
      ) {
        throw cause;
      }
      throw new HttpUnreachableError(
        `${method} ${redact(currentUrl)} 失败（${describeCause(cause)}）`,
        cause,
      );
    }
    const text = await response.text();
    if (!response.ok) {
      throw new HttpError(
        response.status,
        truncate(text),
        `${method} ${redact(currentUrl)} → HTTP ${response.status}`,
      );
    }
    if (text === '') {
      return undefined as T;
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new HttpError(
        response.status,
        truncate(text),
        `${method} ${redact(currentUrl)} 响应非合法 JSON`,
      );
    }
  }
}

function describeCause(cause: unknown): string {
  if (
    cause instanceof Error &&
    (cause.name === 'TimeoutError' || cause.name === 'AbortError')
  ) {
    return '超时';
  }
  return cause instanceof Error ? cause.message : String(cause);
}

function truncate(text: string): string {
  return text.length > ERROR_BODY_MAX_LENGTH
    ? `${text.slice(0, ERROR_BODY_MAX_LENGTH)}…`
    : text;
}

/** URL 中的查询串可能携带敏感参数，错误信息只保留地址本体。 */
function redact(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return url;
  }
}
