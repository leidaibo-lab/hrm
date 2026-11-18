/**
 * 领域不变量违反；application 层负责映射为 HTTP 语义（409/422 等）。
 * 本层禁止依赖 @nestjs/* 与 Prisma（ADR-0014 附录 A）。
 */
export class DomainError extends Error {
  constructor(
    /** 业务错误码，取值与 @cip/shared ERROR_CODE 对齐（响应 code 单源）。 */
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
