import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { number } from '../basic';

describe('数值列的显示优先级与零值', () => {
  it('自定义格式化优先，不执行被覆盖的精度格式化', () => {
    const column = number<{ amount: number }>('amount', '金额', {
      precision: 101,
      format: (value) => `自定义金额 ${value}`,
    });
    expect(renderToStaticMarkup(column.cell?.({ amount: 12 }))).toContain(
      '自定义金额 12',
    );
  });
  it('合法零值按精度显示，不退化为空值', () => {
    const column = number<{ amount: number }>('amount', '金额', {
      precision: 2,
    });
    expect(renderToStaticMarkup(column.cell?.({ amount: 0 }))).toContain(
      '0.00',
    );
  });
});
