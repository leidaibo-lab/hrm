import { ERROR_CODE } from '@cip/shared';
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { env } from '../../config/env';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF 防线：写请求的 Origin 必须在允许列表内。
 * 无 Origin 的非浏览器客户端放行（CSRF 攻击面只在浏览器，SameSite=Lax 为第一道）。
 * 注册顺序在 SessionGuard 之前：未过来源校验的写请求不进入认证。
 */
@Injectable()
export class OriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) return true;

    const origin = request.headers.origin;
    if (origin === undefined) return true;
    if (!env.AUTH_ALLOWED_ORIGINS.includes(origin)) {
      throw new ForbiddenException({
        code: ERROR_CODE.auth.originNotAllowed,
        message: '来源不被允许',
      });
    }
    return true;
  }
}
