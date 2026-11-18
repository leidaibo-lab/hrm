import { SetMetadata } from '@nestjs/common';

/** 调用上下文元数据键：标注路由的计量调用方来源。 */
export const CALL_CONTEXT_CALLER = 'call_context_caller';

/** 标注路由的调用方来源：CallContextInterceptor 据此写入 AsyncLocalStorage。 */
export const CallContextCaller = (caller: string) =>
  SetMetadata(CALL_CONTEXT_CALLER, caller);
