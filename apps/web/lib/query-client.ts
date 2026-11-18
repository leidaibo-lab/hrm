import type { QueryClient } from '@tanstack/react-query';

/** 取消旧身份请求后清空缓存，防止延迟响应恢复已退出身份的数据。 */
export async function clearSessionCache(client: QueryClient): Promise<void> {
  await client.cancelQueries();
  client.clear();
}
