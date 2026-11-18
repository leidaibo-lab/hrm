import { type ErrorCode } from '@cip/shared';

/**
 * 领域不变量违反：携带平台业务错误码，应用层翻译为 HTTP 语义（对齐 iam 域模式）。
 */
export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
