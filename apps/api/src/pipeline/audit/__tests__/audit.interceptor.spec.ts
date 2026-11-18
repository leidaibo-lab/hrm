import {
  type CallHandler,
  type ExecutionContext,
  Logger,
} from '@nestjs/common';
import { type Reflector } from '@nestjs/core';
import { firstValueFrom, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditInterceptor } from '../audit.interceptor';

function createDeps(action?: string) {
  const create = vi.fn().mockResolvedValue({});
  const prisma = { auditLog: { create } };
  const reflector = { getAllAndOverride: vi.fn().mockReturnValue(action) };
  const interceptor = new AuditInterceptor(
    prisma as never,
    reflector as unknown as Reflector,
  );
  const request = {
    method: 'POST',
    url: '/api/v1/demo',
    originalUrl: '/api/v1/demo',
    headers: {},
    id: 'trace-1',
  };
  const response = { statusCode: 201 };
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
    getHandler: () => vi.fn(),
    getClass: () => vi.fn(),
  } as unknown as ExecutionContext;
  const next: CallHandler = { handle: () => of({ ok: true }) };
  return { interceptor, context, next, create, request, response };
}

describe('AuditInterceptor', () => {
  // 审计写入失败用例走真实 logger.warn；测试内静默并断言，避免测试输出噪声。
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('无 @Audit 元数据时直接放行，不写审计', async () => {
    const { interceptor, context, next, create } = createDeps(undefined);
    const result = await firstValueFrom(interceptor.intercept(context, next));
    expect(result).toEqual({ ok: true });
    expect(create).not.toHaveBeenCalled();
  });

  it('命中 @Audit 时按请求事实落审计（traceId/method/path/statusCode）', async () => {
    const { interceptor, context, next, create } = createDeps('demo.action');
    await firstValueFrom(interceptor.intercept(context, next));
    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0][0].data).toMatchObject({
      traceId: 'trace-1',
      action: 'demo.action',
      method: 'POST',
      path: '/api/v1/demo',
      statusCode: 201,
    });
  });

  it('端点抛错时记录失败状态码与错误摘要', async () => {
    const create = vi.fn().mockResolvedValue({});
    const interceptor = new AuditInterceptor(
      { auditLog: { create } } as never,
      { getAllAndOverride: vi.fn().mockReturnValue('demo.action') } as never,
    );
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', originalUrl: '/x', headers: {} }),
        getResponse: () => ({ statusCode: 500 }),
      }),
      getHandler: () => vi.fn(),
      getClass: () => vi.fn(),
    } as unknown as ExecutionContext;
    const failing: CallHandler = {
      handle: () => throwError(() => ({ status: 404, message: '无此资源' })),
    };

    // 拦截器语义：异常原样透传（响应形态交给全局过滤器），审计旁路落库
    await expect(
      firstValueFrom(interceptor.intercept(context, failing)),
    ).rejects.toMatchObject({
      status: 404,
    });

    expect(create.mock.calls[0][0].data).toMatchObject({
      statusCode: 404,
      detail: { message: '无此资源' },
    });
  });

  it('审计写入失败不得影响业务响应', async () => {
    const create = vi.fn().mockRejectedValue(new Error('db down'));
    const interceptor = new AuditInterceptor(
      { auditLog: { create } } as never,
      { getAllAndOverride: vi.fn().mockReturnValue('demo.action') } as never,
    );
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', originalUrl: '/x', headers: {} }),
        getResponse: () => ({ statusCode: 200 }),
      }),
      getHandler: () => vi.fn(),
      getClass: () => vi.fn(),
    } as unknown as ExecutionContext;

    const result = await firstValueFrom(
      interceptor.intercept(context, { handle: () => of('ok') }),
    );
    expect(result).toBe('ok');
    expect(warnSpy).toHaveBeenCalled();
  });
});
