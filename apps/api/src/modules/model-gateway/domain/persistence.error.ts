import type { ErrorCode } from '@cip/shared';

/**
 * 持久化约束违反：领域层可识别的冲突/引用错误，应用层翻译为 HTTP 语义。
 * infrastructure 只在此类型内暴露存储错误，application 不依赖 Prisma。
 */
export class PersistenceError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PersistenceError';
  }
}
