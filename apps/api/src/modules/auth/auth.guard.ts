import { ERROR_CODE, SESSION_COOKIE_NAME } from '@cip/shared';
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY, type SessionUser } from '../../pipeline/guards';
import { UserService } from '../iam/application/user.service';
import { SessionService } from './application/session.service';

/**
 * 认证 guard（全局，注册于 app.module 的 APP_GUARD 链：Origin → Session → Policies）：
 * sid cookie → 会话解析 → 会话用户挂 req.user。
 * 会话读取单源 SessionService（键与 payload 解析唯一事实源，ADR-0016）；
 * 身份与权限点经 iam 导出的 UserService 每请求实时展开，不做权限缓存：
 * 撤销权限/挂起用户对下一请求立即生效。
 * @Public() 端点跳过；未认证返回 401 auth.unauthorized。
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly sessions: SessionService,
    private readonly users: UserService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const sid = request.cookies?.[SESSION_COOKIE_NAME];
    if (typeof sid !== 'string' || sid.length === 0) {
      throw new UnauthorizedException({
        code: ERROR_CODE.auth.unauthorized,
        message: '未登录',
      });
    }

    const session = await this.sessions.resolve(sid);
    if (!session) {
      throw new UnauthorizedException({
        code: ERROR_CODE.auth.unauthorized,
        message: '会话已过期',
      });
    }

    const user = await this.users.findSessionUser(session.userId);
    if (!user) {
      throw new UnauthorizedException({
        code: ERROR_CODE.auth.unauthorized,
        message: '会话已过期',
      });
    }

    (request as Request & { user?: SessionUser }).user = user;
    return true;
  }
}
