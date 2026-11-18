import { describe, expect, it } from 'vitest';
import { ModelPricing } from '../model-pricing.entity';
import { ProviderModel } from '../provider-model.entity';

const capabilities = {
  contextWindow: 8192,
  maxOutputTokens: 4096,
  toolCall: true,
  imageInput: false,
  audioInput: false,
  structuredOutput: true,
  reasoning: false,
  embedding: false,
  streaming: true,
};

describe('模型聚合引用隔离', () => {
  it('注册、配置和 getter 都不泄漏内部可变对象', () => {
    const input = { ...capabilities };
    const params = { temperature: 0.5 };
    const model = ProviderModel.register({
      providerId: 'p',
      modelId: 'm',
      logicalKey: 'm',
      displayName: 'M',
      capabilities: input,
      defaultParams: params,
    });
    input.contextWindow = 1;
    params.temperature = 1;
    expect(model.capabilities.contextWindow).toBe(8192);
    expect(model.defaultParams?.temperature).toBe(0.5);
    const output = model.capabilities;
    output.toolCall = false;
    expect(model.capabilities.toolCall).toBe(true);
    const next = { ...capabilities, contextWindow: 16384 };
    model.reconfigure({
      displayName: 'new',
      capabilities: next,
      defaultParams: null,
    });
    next.contextWindow = 0;
    expect(model.capabilities.contextWindow).toBe(16384);
  });
  it('费率和生效时间不会通过外部引用改变', () => {
    const at = new Date('2026-01-01T00:00:00Z');
    const rates = {
      input: 1,
      output: 2,
      cacheRead: null,
      cacheWrite: null,
      reasoning: null,
    };
    const pricing = ModelPricing.register({
      modelId: 'm',
      currency: 'USD',
      rates,
      effectiveFrom: at,
    });
    at.setFullYear(2050);
    rates.input = 999;
    pricing.effectiveFrom.setFullYear(2099);
    pricing.rates.input = 888;
    expect(pricing.rates.input).toBe(1);
    expect(pricing.isEffectiveAt(new Date('2026-02-01T00:00:00Z'))).toBe(true);
  });
});
