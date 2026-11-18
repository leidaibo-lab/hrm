'use client';

import type { z } from 'zod';
import type { BrowserStorageHandle } from '@/hooks/use-local-storage';
import { useBrowserStorage } from '@/hooks/use-local-storage';

/**
 * 泛型 sessionStorage hook：查询状态等会话内恢复；关闭标签即失效，
 * 存储不可用时由调用方回退内存（ready 前不发默认查询）。
 */
export function useSessionStorage<T>(config: {
  key: string;
  schema: z.ZodType<T>;
  defaultValue: T;
}): BrowserStorageHandle<T> {
  return useBrowserStorage('session', config);
}
