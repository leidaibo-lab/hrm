import type { ErrorCode } from '@cip/shared';
import { PersistenceError } from '../domain/persistence.error';

/** Prisma 错误码：唯一约束冲突 / 外键引用。 */
const UNIQUE_CONFLICT = 'P2002';
const FOREIGN_KEY_CONFLICT = 'P2003';

/**
 * 把存储层约束错误翻译为领域可识别错误；未识别的错误原样抛出。
 * @param cause - Prisma 抛出的原始错误。
 * @param codes - 冲突与引用两种场景对应的业务错误码。
 */
export function translatePersistenceError(
  cause: unknown,
  codes: { conflict: ErrorCode; referenced?: ErrorCode },
): never {
  if (cause instanceof PersistenceError) throw cause;
  const code = (cause as { code?: unknown }).code;
  if (code === UNIQUE_CONFLICT) {
    throw new PersistenceError(codes.conflict, '记录已存在（唯一约束冲突）');
  }
  if (code === FOREIGN_KEY_CONFLICT && codes.referenced) {
    throw new PersistenceError(codes.referenced, '记录被引用，无法删除');
  }
  throw cause;
}
