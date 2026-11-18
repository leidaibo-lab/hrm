import type { z } from 'zod';

/**
 * 浏览器存储的私有工具：JSON 序列化 + zod schema 校验 + 读写失败静默降级。
 * 存储只能是偏好/恢复来源，不是授权或数据正确性来源；
 * 不可用时读写返回 null，由调用方回退内存默认值。
 */

/** 存储读取结果：损坏或不可用时 data 为 null。 */
export type StorageRead<T> = {
  /** 通过结构校验的存储数据；损坏或不可用时为空。 */
  data: T | null;
  /** 结构化失败信息；保留机器判断所需字段。 */
  error: Error | null;
};

/** 安全读取并按 schema 校验；损坏/过期数据返回 null（调用方决定是否清理）。 */
export function safeReadStorage<T>(
  storage: 'local' | 'session',
  key: string,
  schema: z.ZodType<T>,
): StorageRead<T> {
  if (typeof window === 'undefined') return { data: null, error: null };
  try {
    const raw =
      storage === 'local'
        ? window.localStorage.getItem(key)
        : window.sessionStorage.getItem(key);
    if (raw === null) return { data: null, error: null };
    const parsed: unknown = JSON.parse(raw);
    const result = schema.safeParse(parsed);
    if (!result.success) {
      return {
        data: null,
        error: new Error(`存储数据校验失败: ${key}`),
      };
    }
    return { data: result.data, error: null };
  } catch (cause) {
    return {
      data: null,
      error: cause instanceof Error ? cause : new Error(String(cause)),
    };
  }
}

/** 安全写入；返回是否成功（配额溢出/隐私模式失败不抛错）。 */
export function safeWriteStorage(
  storage: 'local' | 'session',
  key: string,
  value: unknown,
): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = JSON.stringify(value);
    if (storage === 'local') window.localStorage.setItem(key, raw);
    else window.sessionStorage.setItem(key, raw);
    return true;
  } catch {
    return false;
  }
}

/** 安全删除键。 */
export function safeRemoveStorage(
  storage: 'local' | 'session',
  key: string,
): void {
  if (typeof window === 'undefined') return;
  try {
    if (storage === 'local') window.localStorage.removeItem(key);
    else window.sessionStorage.removeItem(key);
  } catch {
    // 清理失败时保留现有内存偏好，调用方无需改变状态。
    return;
  }
}
