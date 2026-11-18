import {
  type ExecutionContext,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { afterEach, describe, expect, it } from 'vitest';
import { env } from '../../../config/env';
import { InternalTokenGuard } from '../index';

const original = env.INTERNAL_API_TOKEN;

afterEach(() => {
  env.INTERNAL_API_TOKEN = original;
});

function context(header?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: header ? { 'x-internal-token': header } : {},
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('InternalTokenGuard', () => {
  it('未配置令牌时返回 503', () => {
    env.INTERNAL_API_TOKEN = '';
    expect(() => new InternalTokenGuard().canActivate(context('x'))).toThrow(
      ServiceUnavailableException,
    );
  });

  it('缺失或错误令牌返回 401', () => {
    env.INTERNAL_API_TOKEN = 'secret';
    expect(() => new InternalTokenGuard().canActivate(context())).toThrow(
      UnauthorizedException,
    );
    expect(() =>
      new InternalTokenGuard().canActivate(context('wrong')),
    ).toThrow(UnauthorizedException);
  });

  it('正确令牌放行', () => {
    env.INTERNAL_API_TOKEN = 'secret';
    expect(new InternalTokenGuard().canActivate(context('secret'))).toBe(true);
  });
});
