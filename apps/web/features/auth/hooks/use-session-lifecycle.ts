'use client';

import type { QueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ApiError } from '@/lib/api-error';
import { clearSessionCache } from '@/lib/query-client';

/** 受保护查询会话失效时取消请求并清空缓存，凭据错误不触发退出。 */
export function useSessionLifecycle(client: QueryClient): void {
  const router = useRouter();
  useEffect(() => {
    let clearing = false;
    return client.getQueryCache().subscribe((event) => {
      if (clearing || event.type !== 'updated' || event.action.type !== 'error')
        return;
      const error = event.query.state.error;
      if (!(error instanceof ApiError) || error.status !== 401) return;
      clearing = true;
      void clearSessionCache(client)
        .then(() => {
          router.replace('/login');
          router.refresh();
        })
        .finally(() => {
          clearing = false;
        });
    });
  }, [client, router]);
}
