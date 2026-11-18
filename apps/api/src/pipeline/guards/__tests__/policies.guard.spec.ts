import { PERMISSION } from '@cip/shared';
import { type ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { buildSessionUser } from '../../../testing';
import { PoliciesGuard } from '../policies.guard';
import { IS_PUBLIC_KEY } from '../public.decorator';
import { REQUIRE_PERMISSION_KEY } from '../require-permission.decorator';

const reflector = new Reflector();

/** 构造 ExecutionContext mock：getHandler/getClass 在顶层，switchToHttp 只承载请求对象。 */
function createContext(
  user: unknown,
  handler: () => unknown,
  controllerClass?: object,
): ExecutionContext {
  const context = {
    getHandler: () => handler,
    getClass: () => controllerClass ?? Object,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  };
  return context as unknown as ExecutionContext;
}

/** 在 handler 上直挂权限点元数据（等价 @RequirePermission 的运行时效果）。 */
function handlerRequiring(...codes: string[]): () => unknown {
  const handler = () => undefined;
  Reflect.defineMetadata(REQUIRE_PERMISSION_KEY, codes, handler);
  return handler;
}

/** 在 handler 上直挂公开标记（等价 @Public 的运行时效果）。 */
function publicHandler(): () => unknown {
  const handler = () => undefined;
  Reflect.defineMetadata(IS_PUBLIC_KEY, true, handler);
  return handler;
}

describe('PoliciesGuard', () => {
  const guard = new PoliciesGuard(reflector);

  it('持有全部声明权限点时放行', () => {
    const handler = handlerRequiring(PERMISSION.user.manage.code);
    const context = createContext(buildSessionUser(['user:manage']), handler);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('缺任一声明权限点时抛 403 auth.forbidden', () => {
    const handler = handlerRequiring(
      PERMISSION.user.manage.code,
      PERMISSION.role.manage.code,
    );
    const context = createContext(buildSessionUser(['user:manage']), handler);
    try {
      guard.canActivate(context);
      expect.unreachable('应抛出 ForbiddenException');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: 'auth.forbidden',
      });
    }
  });

  it('通配权限 [*] 放行任意声明', () => {
    const handler = handlerRequiring(PERMISSION.navigation.manage.code);
    const context = createContext(buildSessionUser(['*']), handler);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('未声明权限点的端点登录即可（deny by default 由端点审计测试强制）', () => {
    const context = createContext(buildSessionUser([]), () => {});
    expect(guard.canActivate(context)).toBe(true);
  });

  it('@Public 端点跳过授权（无会话也放行）', () => {
    const context = createContext(undefined, publicHandler());
    expect(guard.canActivate(context)).toBe(true);
  });
});
