import { buildAbility, ERROR_CODE } from '@cip/shared';
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';
import { REQUIRE_PERMISSION_KEY } from './require-permission.decorator';
import type { SessionUser } from './session-user.type';

/**
 * 授权 guard（全局）：按 @RequirePermission 声明用 CASL ability 判定。
 * 运行时规则：@Public 端点跳过；声明了权限点则全部满足才放行；未声明的非公开端点
 * 视为「登录即可」。deny by default 由端点权限审计测试在 CI 强制。
 */
@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: SessionUser }>();
    const ability = buildAbility(request.user?.permissions ?? []);
    const allowed = required.every((code) => {
      const separator = code.indexOf(':');
      return ability.can(
        code.slice(separator + 1) as Parameters<typeof ability.can>[0],
        code.slice(0, separator) as Parameters<typeof ability.can>[1],
      );
    });
    if (!allowed) {
      throw new ForbiddenException({
        code: ERROR_CODE.auth.forbidden,
        message: '无权执行此操作',
      });
    }
    return true;
  }
}
