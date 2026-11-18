import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  ZodValidationException,
  ZodValidationPipe,
} from '../zod-validation.pipe';

const schema = z.object({ name: z.string() });

describe('ZodValidationPipe', () => {
  it('合法输入返回解析后的数据', () => {
    const pipe = new ZodValidationPipe(schema);
    expect(pipe.transform({ name: 'cip' }, {} as never)).toEqual({
      name: 'cip',
    });
  });

  it('非法输入抛 ZodValidationException 并携带字段级错误', () => {
    const pipe = new ZodValidationPipe(schema);
    try {
      pipe.transform({ name: 1 }, {} as never);
      expect.unreachable('应抛出异常');
    } catch (error) {
      expect(error).toBeInstanceOf(ZodValidationException);
      const exception = error as ZodValidationException;
      expect(exception.fieldErrors[0]?.path).toBe('name');
      expect(exception.fieldErrors[0]?.message).toBeTruthy();
    }
  });
});
