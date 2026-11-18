/** 价格来源：人工维护优先，models.dev 目录价兜底。 */
export type PriceSource = 'manual' | 'models_dev';

/** 计价 token 口径：输入总量含缓存读写；输出总量含推理。 */
export interface TokenUsage {
  /** 输入 token 总量（含缓存读写）。 */
  inputTotal: number;
  /** 缓存读取 token 数。 */
  cacheRead: number;
  /** 缓存写入 token 数。 */
  cacheWrite: number;
  /** 输出 token 总量（含推理）。 */
  outputTotal: number;
  /** 推理 token 数。 */
  reasoning: number;
}

/** 价格版本视图：费率为「原币 / 每百万 token」的十进制字符串。 */
export interface PriceVersion {
  /** 价格版本主键。 */
  id: string;
  /** 价格来源。 */
  source: PriceSource;
  /** 原币种（ISO 4217）。 */
  currency: string;
  /** 输入价：原币 / 每百万 token。 */
  input: string;
  /** 输出价：原币 / 每百万 token。 */
  output: string;
  /** 缓存读取价；空表示回落输入价。 */
  cacheRead: string | null;
  /** 缓存写入价；空表示回落输入价。 */
  cacheWrite: string | null;
  /** 推理价；空表示按输出价。 */
  reasoning: string | null;
  /** 生效时间。 */
  effectiveFrom: Date;
}

/** 汇率版本视图：1 单位原币折合多少 USD。 */
export interface FxVersion {
  /** 汇率版本主键。 */
  id: string;
  /** 原币种（ISO 4217）。 */
  currency: string;
  /** 1 单位原币折合的 USD 数。 */
  rateToBase: string;
  /** 生效时间。 */
  effectiveFrom: Date;
}

const SCALE = 100_000_000n;

function parseScaled8(value: string): bigint {
  const [integer = '0', fraction = ''] = value.split('.');
  const frac = (fraction + '00000000').slice(0, 8);
  return BigInt(integer) * SCALE + BigInt(frac || '0');
}

function formatScaled8(value: bigint): string {
  const sign = value < 0n ? '-' : '';
  const abs = value < 0n ? -value : value;
  const integer = abs / SCALE;
  const fraction = (abs % SCALE).toString().padStart(8, '0');
  return `${sign}${integer}.${fraction}`;
}

/** a * b / divisor，四舍五入（HALF_UP）。 */
function multiplyDivide(a: bigint, b: bigint, divisor: bigint): bigint {
  const product = a * b;
  const quotient = product / divisor;
  const remainder = product % divisor;
  return remainder * 2n >= divisor ? quotient + 1n : quotient;
}

/** 选择生效价格：手动价优先，目录价兜底。 */
export function pickPrice(
  manual: readonly PriceVersion[],
  catalog: PriceVersion | null,
  at: Date,
): PriceVersion | null {
  const manualEffective = manual
    .filter((version) => version.effectiveFrom.getTime() <= at.getTime())
    .sort(
      (left, right) =>
        right.effectiveFrom.getTime() - left.effectiveFrom.getTime(),
    )[0];
  if (manualEffective) return manualEffective;
  if (catalog && catalog.effectiveFrom.getTime() <= at.getTime())
    return catalog;
  return null;
}

/** 原币成本：Σ(tokens × rate) / 1e6，保留 8 位小数。 */
export function computeCost(tokens: TokenUsage, price: PriceVersion): string {
  const uncached = Math.max(
    0,
    tokens.inputTotal - tokens.cacheRead - tokens.cacheWrite,
  );
  const input = parseScaled8(price.input);
  const output = parseScaled8(price.output);
  const cacheRead = price.cacheRead ? parseScaled8(price.cacheRead) : input;
  const cacheWrite = price.cacheWrite ? parseScaled8(price.cacheWrite) : input;
  const reasoningRate = price.reasoning
    ? parseScaled8(price.reasoning)
    : output;

  const total =
    BigInt(uncached) * input +
    BigInt(tokens.cacheRead) * cacheRead +
    BigInt(tokens.cacheWrite) * cacheWrite +
    BigInt(tokens.outputTotal) * output +
    BigInt(tokens.reasoning) *
      (reasoningRate > output ? reasoningRate - output : 0n);

  return formatScaled8(multiplyDivide(total, 1n, 1_000_000n));
}

/** 折算 USD：cost × rate_to_base；缺汇率返回 null 与 missing 标记。 */
export function convertToBase(
  costOriginal: string,
  currency: string,
  fx: FxVersion | null,
  at: Date,
): { cost: string; rate: string; fxRateId: string | null } | null {
  if (currency === 'USD') {
    return { cost: costOriginal, rate: '1.00000000', fxRateId: null };
  }
  if (!fx || fx.effectiveFrom.getTime() > at.getTime()) return null;
  return {
    cost: formatScaled8(
      multiplyDivide(
        parseScaled8(costOriginal),
        parseScaled8(fx.rateToBase),
        SCALE,
      ),
    ),
    rate: fx.rateToBase,
    fxRateId: fx.id,
  };
}
