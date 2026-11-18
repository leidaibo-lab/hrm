import type { TableScope } from '../types';

/** 范围键保留值类型和分隔字符，避免不同范围共享缓存或偏好。 */
export function tableScopeKey(scope: TableScope = {}): string {
  return JSON.stringify(
    Object.entries(scope).sort(([a], [b]) => a.localeCompare(b)),
  );
}
