import { randomUUID } from 'node:crypto';
import type { ErrorCode, ProblemDetails } from '@cip/shared';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/** RFC 9457 标准成员 title：保留标准 HTTP 短语，人类可读细节放 detail。 */
const HTTP_TITLES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
};

function defaultErrorCode(status: number): ErrorCode {
  if (status >= 500) return 'server.error';
  if (status === 404) return 'request.not_found';
  return 'request.invalid';
}

/**
 * 全局唯一错误出口：所有失败响应输出 application/problem+json。
 * 业务错误码取异常负载里的 code，否则按状态码取默认值；500 不透出内部异常细节。
 */
@Catch()
export class ProblemDetailsExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = isHttpException ? exception.getResponse() : undefined;

    let code = defaultErrorCode(status);
    let detail: string | undefined;
    let errors: ProblemDetails['errors'];

    if (isHttpException) {
      if (typeof payload === 'string') {
        detail = payload;
      } else if (payload && typeof payload === 'object') {
        const body = payload as {
          code?: unknown;
          message?: unknown;
          errors?: unknown;
        };
        if (typeof body.code === 'string') code = body.code as ErrorCode;
        if (typeof body.message === 'string') detail = body.message;
        if (Array.isArray(body.errors))
          errors = body.errors as ProblemDetails['errors'];
      }
    }

    const traceId =
      (request as Request & { id?: string }).id ??
      (request.headers['x-request-id'] as string | undefined) ??
      randomUUID();

    if (status >= 500) {
      this.logger.error(
        `未处理异常: ${exception instanceof Error ? exception.stack : String(exception)}`,
      );
    }
    if (!isHttpException) {
      // 未知异常不透出内部信息；HttpException 的 5xx 负载是开发者显式给出的，保留
      detail = '服务器内部错误';
    }

    const body: ProblemDetails = {
      type: 'about:blank',
      title: HTTP_TITLES[status] ?? 'Error',
      status,
      code,
      traceId,
      instance: request.originalUrl,
      ...(detail !== undefined ? { detail } : {}),
      ...(errors ? { errors } : {}),
    };

    response.status(status).type('application/problem+json').send(body);
  }
}
