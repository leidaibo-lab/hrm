import { describe, expect, it } from 'vitest';
import {
  computeCost,
  convertToBase,
  type PriceVersion,
  pickPrice,
} from '../price.entity';

function price(overrides: Partial<PriceVersion>): PriceVersion {
  return {
    id: 'price',
    source: 'manual',
    currency: 'USD',
    input: '3',
    output: '15',
    cacheRead: null,
    cacheWrite: null,
    reasoning: null,
    effectiveFrom: new Date(0),
    ...overrides,
  };
}

describe('pickPrice', () => {
  it('手动价优先于目录价', () => {
    const selected = pickPrice(
      [price({ id: 'manual', input: '4' })],
      price({ id: 'catalog', source: 'models_dev', input: '2' }),
      new Date(10),
    );
    expect(selected?.id).toBe('manual');
  });

  it('无手动价时使用目录价', () => {
    const selected = pickPrice(
      [],
      price({
        id: 'catalog',
        source: 'models_dev',
        input: '2',
        effectiveFrom: new Date(0),
      }),
      new Date(10),
    );
    expect(selected?.id).toBe('catalog');
  });

  it('都无生效版本时返回 null', () => {
    expect(
      pickPrice([price({ effectiveFrom: new Date(20) })], null, new Date(10)),
    ).toBeNull();
  });
});

describe('computeCost', () => {
  it('按每百万 token 计算', () => {
    expect(
      computeCost(
        {
          inputTotal: 1000,
          cacheRead: 0,
          cacheWrite: 0,
          outputTotal: 0,
          reasoning: 0,
        },
        price({}),
      ),
    ).toBe('0.00300000');
  });

  it('输入总量扣除缓存，缓存按各自费率', () => {
    expect(
      computeCost(
        {
          inputTotal: 1000,
          cacheRead: 400,
          cacheWrite: 100,
          outputTotal: 200,
          reasoning: 0,
        },
        price({ cacheRead: '0.3', cacheWrite: '3.75', output: '15' }),
      ),
    ).toBe('0.00499500');
  });

  it('推理单列费率时只补差额', () => {
    expect(
      computeCost(
        {
          inputTotal: 0,
          cacheRead: 0,
          cacheWrite: 0,
          outputTotal: 100,
          reasoning: 40,
        },
        price({ output: '15', reasoning: '60' }),
      ),
    ).toBe('0.00330000');
  });
});

describe('convertToBase', () => {
  it('原币按 rate_to_base 折算 USD', () => {
    expect(
      convertToBase(
        '0.00200000',
        'CNY',
        {
          id: 'fx',
          currency: 'CNY',
          rateToBase: '0.1389',
          effectiveFrom: new Date(0),
        },
        new Date(10),
      ),
    ).toEqual({ cost: '0.00027780', rate: '0.1389', fxRateId: 'fx' });
  });

  it('缺汇率时返回 null', () => {
    expect(convertToBase('0.00200000', 'CNY', null, new Date(10))).toBeNull();
  });
});
