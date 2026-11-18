import { describe, expect, it } from 'vitest';
import { ERROR_CODE, ERROR_CODES } from '../errors';

describe('ERROR_CODE', () => {
  it('命名映射覆盖全部错误码（数组无孤儿项）', () => {
    const mapped = new Set(
      Object.values(ERROR_CODE).flatMap((group) => Object.values(group)),
    );
    for (const code of ERROR_CODES) {
      expect(mapped.has(code), `错误码 ${code} 缺少命名映射`).toBe(true);
    }
  });

  it('命名映射无越界项（映射值都在数组内）', () => {
    const declared = new Set<string>(ERROR_CODES);
    for (const group of Object.values(ERROR_CODE)) {
      for (const code of Object.values(group)) {
        expect(declared.has(code), `映射项 ${code} 未登记进 ERROR_CODES`).toBe(
          true,
        );
      }
    }
  });
});
