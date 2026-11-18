import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { CALL_CONTEXT_CALLER } from './call-context.decorator';
import { runWithCallContext } from './call-context.helper';

/**
 * 调用上下文拦截器（全局）：仅对标注 @CallContextCaller 的路由生效，
 * 把 traceId 与调用方来源放入 AsyncLocalStorage，供计量包装在真实调用现场读取。
 */
@Injectable()
export class CallContextInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const caller = this.reflector.getAllAndOverride<string | undefined>(
      CALL_CONTEXT_CALLER,
      [context.getHandler(), context.getClass()],
    );
    if (!caller) return next.handle();
    const request = context
      .switchToHttp()
      .getRequest<Request & { id?: string }>();
    const traceId =
      request.id ??
      (request.headers['x-request-id'] as string | undefined) ??
      null;
    return new Observable((subscriber) =>
      runWithCallContext({ traceId, caller }, () =>
        next.handle().subscribe(subscriber),
      ),
    );
  }
}
