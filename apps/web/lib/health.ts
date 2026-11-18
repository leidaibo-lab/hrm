import { env } from './env';

/** 检查运维探针；不访问业务端点，也不共享缓存。 */
export async function probeHealth(): Promise<boolean> {
  return (
    await fetch(`${env.NEXT_PUBLIC_API_BASE_URL}/healthz`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
  ).ok;
}
