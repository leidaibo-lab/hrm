import { ERROR_CODE, type ErrorCode } from '@cip/shared';
import { DomainError } from '../domain/domain.error';

/** 将数据库约束错误转换为模块稳定错误，未知错误保持原始原因。 */
export function toPersistenceError(cause: unknown): unknown {
  if (typeof cause !== 'object' || cause === null) return cause;
  const code = (cause as { code?: string }).code;
  if (code === 'P2003')
    return new DomainError(
      ERROR_CODE.model.inUse,
      '存在关联数据，禁止删除；可停用代替',
    );
  if (code === 'P2002') {
    const target = (cause as { meta?: { target?: unknown } }).meta?.target;
    const fields = Array.isArray(target) ? target : [];
    let errorCode: ErrorCode = ERROR_CODE.model.logicalKeyConflict;
    if (fields.includes('slug')) errorCode = ERROR_CODE.model.slugConflict;
    else if (fields.includes('providerId'))
      errorCode = ERROR_CODE.model.modelConflict;
    return new DomainError(errorCode, '注册标识已存在');
  }
  return cause;
}
