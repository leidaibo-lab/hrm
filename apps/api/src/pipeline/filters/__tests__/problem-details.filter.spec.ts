import {
  type ArgumentsHost,
  BadRequestException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProblemDetailsExceptionFilter } from '../problem-details.filter';

function createHost() {
  const response = {
    status: vi.fn().mockReturnThis(),
    type: vi.fn().mockReturnThis(),
    send: vi.fn(),
  };
  const request = {
    headers: {} as Record<string, string | string[] | undefined>,
    originalUrl: '/api/v1/demo',
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { response, request, host };
}

describe('ProblemDetailsExceptionFilter', () => {
  // 500/503 用例会走真实 logger.error；测试内静默并断言，避免错误日志污染测试输出。
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('HttpException 映射为 problem+json 且按状态码取默认错误码', () => {
    const filter = new ProblemDetailsExceptionFilter();
    const { response, host } = createHost();

    filter.catch(new NotFoundException('项目不存在'), host);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.type).toHaveBeenCalledWith('application/problem+json');
    const body = response.send.mock.calls[0][0] as Record<string, unknown>;
    expect(body.code).toBe('request.not_found');
    expect(body.title).toBe('Not Found');
    expect(body.detail).toBe('项目不存在');
    expect(body.instance).toBe('/api/v1/demo');
    expect(typeof body.traceId).toBe('string');
  });

  it('未知异常返回 500 且不透出内部信息', () => {
    const filter = new ProblemDetailsExceptionFilter();
    const { response, host } = createHost();
    const secretError = new Error('内部堆栈: /db/password=secret');

    filter.catch(secretError, host);

    const body = response.send.mock.calls[0][0] as Record<string, unknown>;
    expect(response.status).toHaveBeenCalledWith(500);
    expect(body.code).toBe('server.error');
    expect(body.detail).toBe('服务器内部错误');
    expect(JSON.stringify(body)).not.toContain('secret');
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('未处理异常'),
    );
  });

  it('透传异常负载中的 code 与 errors', () => {
    const filter = new ProblemDetailsExceptionFilter();
    const { response, host } = createHost();

    filter.catch(
      new BadRequestException({
        code: 'request.invalid',
        message: '请求参数无效',
        errors: [{ path: 'name', message: '必填' }],
      }),
      host,
    );

    const body = response.send.mock.calls[0][0] as Record<string, unknown>;
    expect(response.status).toHaveBeenCalledWith(400);
    expect(body.code).toBe('request.invalid');
    expect(body.errors).toEqual([{ path: 'name', message: '必填' }]);
  });

  it('HttpException 的 5xx 负载保留显式 detail（如 readyz 503）', () => {
    const filter = new ProblemDetailsExceptionFilter();
    const { response, host } = createHost();

    filter.catch(
      new ServiceUnavailableException({
        code: 'health.db_unavailable',
        message: '数据库不可用',
      }),
      host,
    );

    const body = response.send.mock.calls[0][0] as Record<string, unknown>;
    expect(response.status).toHaveBeenCalledWith(503);
    expect(body.code).toBe('health.db_unavailable');
    expect(body.detail).toBe('数据库不可用');
    expect(body.title).toBe('Service Unavailable');
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('未处理异常'),
    );
  });

  it('请求头 x-request-id 透传为 traceId', () => {
    const filter = new ProblemDetailsExceptionFilter();
    const { response, request, host } = createHost();
    request.headers['x-request-id'] = 'trace-123';

    filter.catch(new NotFoundException(), host);

    const body = response.send.mock.calls[0][0] as Record<string, unknown>;
    expect(body.traceId).toBe('trace-123');
  });
});
