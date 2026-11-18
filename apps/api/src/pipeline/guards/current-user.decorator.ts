import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { SessionUser } from './session-user.type';

/**
 * 取当前认证用户；必须在 SessionGuard 生效的路由内使用。
 * @example me(@CurrentUser() user: SessionUser)
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SessionUser => {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: SessionUser }>();
    if (!request.user) {
      throw new Error('CurrentUser 仅可在 SessionGuard 生效的路由内使用');
    }
    return request.user;
  },
);
