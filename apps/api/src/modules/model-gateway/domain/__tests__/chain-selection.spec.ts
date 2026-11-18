import type { ModelCapabilities } from '@cip/shared';
import { describe, expect, it } from 'vitest';
import type { CandidateEntry } from '../candidate.entity';
import { LogicalModelEntity } from '../logical-model.entity';

function capabilities(
  overrides: Partial<ModelCapabilities> = {},
): ModelCapabilities {
  return {
    contextWindow: 128_000,
    maxOutputTokens: 8_192,
    toolCall: true,
    imageInput: false,
    audioInput: false,
    structuredOutput: true,
    reasoning: false,
    embedding: false,
    streaming: true,
    ...overrides,
  };
}

function candidate(overrides: Partial<CandidateEntry>): CandidateEntry {
  return {
    id: 'candidate',
    logicalModelId: 'logical',
    providerId: 'provider',
    providerSlug: 'provider',
    providerModelId: 'model',
    priority: 10,
    enabled: true,
    capabilities: capabilities(),
    providerEnabled: true,
    providerHealth: 'healthy',
    providerOpenUntil: null,
    ...overrides,
  };
}

describe('LogicalModelEntity.resolveChain', () => {
  const logical = new LogicalModelEntity('id', 'chat-main', true, 3);

  it('按优先级排序并截断 maxAttempts', () => {
    const chain = logical.resolveChain(
      [
        candidate({ id: 'slow', priority: 2 }),
        candidate({ id: 'fast', priority: 1 }),
      ],
      { at: new Date(0), requirement: {}, maxAttempts: 3 },
    );
    expect(chain.map((entry) => entry.id)).toEqual(['fast', 'slow']);
  });

  it('过滤停用、降级、熔断与能力不满足', () => {
    const chain = logical.resolveChain(
      [
        candidate({ id: 'disabled', enabled: false }),
        candidate({ id: 'degraded', providerHealth: 'degraded' }),
        candidate({ id: 'open', providerOpenUntil: new Date(2_000) }),
        candidate({
          id: 'no-tool',
          capabilities: capabilities({ toolCall: false }),
        }),
        candidate({ id: 'ok' }),
      ],
      {
        at: new Date(1_000),
        requirement: { toolCall: true },
        maxAttempts: 3,
      },
    );
    expect(chain.map((entry) => entry.id)).toEqual(['ok']);
  });

  it('无满足候选时返回能力不支持', () => {
    expect(() =>
      logical.resolveChain([candidate({ enabled: false })], {
        at: new Date(0),
        requirement: {},
        maxAttempts: 3,
      }),
    ).toThrowError(
      expect.objectContaining({ code: 'model.capability_unsupported' }),
    );
  });

  it('逻辑模型停用时拒绝解析', () => {
    const disabled = new LogicalModelEntity('id', 'chat-main', false, 3);
    expect(() =>
      disabled.resolveChain([candidate({})], {
        at: new Date(0),
        requirement: {},
        maxAttempts: 3,
      }),
    ).toThrowError(
      expect.objectContaining({ code: 'model.logical_model_not_found' }),
    );
  });
});
