import { AsyncLocalStorage } from 'node:async_hooks';

/** 调用上下文：随真实模型调用现场（doGenerate/doStream）采集，随计量入队落库。 */
export interface CallContextValue {
  /** 贯穿日志 / 审计的同源标识；报表按它聚合同一次运行的多笔调用。 */
  traceId: string | null;
  /** 调用方来源：'admin-test' / 'gateway' / 未来 'agent' 等（ADR-0015）。 */
  caller: string | null;
}

const storage = new AsyncLocalStorage<CallContextValue>();

/**
 * 以给定上下文执行异步函数：模型调用发生在此闭包内时被计量捕获。
 * 未来 agents 域启动 run 时同样经本入口携带 runId 级上下文（ADR-0015 约定）。
 */
export function runWithCallContext<T>(
  context: CallContextValue,
  fn: () => T,
): T {
  return storage.run(context, fn);
}

/** 读取当前调用上下文；无上下文（脚本/队列等裸调用）时为 null 值。 */
export function currentCallContext(): CallContextValue {
  return storage.getStore() ?? { traceId: null, caller: null };
}
