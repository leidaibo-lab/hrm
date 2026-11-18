import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { tap } from 'rxjs';
import { PrismaService } from '../../platform/prisma';
import type { SessionUser } from '../guards';
import { AUDIT_ACTION_KEY } from './audit.decorator';

/**
 * 全局审计拦截器：经 @Audit(action) 标记的端点在响应/抛错后落 audit 表。
 * 审计写失败不得影响业务响应（吞掉并告警日志）。
 * actorId 取请求上下文认证用户（SessionGuard 挂载）；未认证端点为 null。
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const action = this.reflector.getAllAndOverride<string>(AUDIT_ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!action) return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest<Request & { user?: SessionUser }>();
    const response = http.getResponse<Response>();

    return next.handle().pipe(
      tap({
        next: () => {
          void this.write(action, request, response.statusCode);
        },
        error: (error: unknown) => {
          const status =
            typeof error === 'object' && error !== null && 'status' in error
              ? Number((error as { status: unknown }).status)
              : 500;
          void this.write(
            action,
            request,
            Number.isFinite(status) ? status : 500,
            error,
          );
        },
      }),
    );
  }

  /**
   * 写入一条审计记录；写失败仅告警，不影响业务响应。
   * @param request - 用于提取 traceId、认证用户与路径。
   */
  private async write(
    action: string,
    request: Request & { user?: SessionUser },
    statusCode: number,
    error?: unknown,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          traceId: resolveTraceId(request),
          actorId: request.user?.id,
          action,
          method: request.method,
          path: request.originalUrl ?? request.url,
          statusCode,
          detail: error
            ? {
                message: extractErrorMessage(error),
              }
            : undefined,
        },
      });
    } catch (cause) {
      this.logger.warn(
        `审计写入失败（不影响业务响应）: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }
  }
}

/**
 * 与全局过滤器同源：pino-http 预生成 req.id，回退 x-request-id 头。
 * @returns 贯穿日志与审计的 traceId，两者皆缺时为 "unknown"。
 */
export function resolveTraceId(request: Request): string {
  const withId = request as Request & { id?: string };
  return (
    withId.id ??
    (request.headers['x-request-id'] as string | undefined) ??
    'unknown'
  );
}

/** HttpException 负载是普通对象时取其 message 字段，避免 "[object Object]"。 */
function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return String(error);
}
