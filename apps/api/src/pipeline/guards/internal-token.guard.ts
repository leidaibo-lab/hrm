import { createHash, timingSafeEqual } from 'node:crypto';
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { env } from '../../config/env';

/**
 * 内部契约鉴权：校验 `x-internal-token` 与 `INTERNAL_API_TOKEN`。
 * 未配置令牌时内部接口视为未启用（503），避免空令牌误放行。
 */
@Injectable()
export class InternalTokenGuard implements CanActivate {
  /** 请求头名称。 */
  private static readonly HEADER = 'x-internal-token';

  /** 校验共享令牌。 */
  canActivate(context: ExecutionContext): boolean {
    const expected = env.INTERNAL_API_TOKEN;
    if (!expected) throw new ServiceUnavailableException('内部接口未启用');
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, unknown>;
    }>();
    const actual = request.headers[InternalTokenGuard.HEADER];
    if (typeof actual !== 'string' || !safeEqual(actual, expected))
      throw new UnauthorizedException('内部令牌无效');
    return true;
  }
}

/** 摘要后定长比较，避免长度与逐字节时序泄漏。 */
function safeEqual(actual: string, expected: string): boolean {
  const left = createHash('sha256').update(actual).digest();
  const right = createHash('sha256').update(expected).digest();
  return timingSafeEqual(left, right);
}
