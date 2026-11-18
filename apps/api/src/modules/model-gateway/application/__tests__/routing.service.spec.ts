import type { ModelCapabilities } from '@cip/shared';
import { describe, expect, it } from 'vitest';
import type { CandidateEntry } from '../../domain/candidate.entity';
import { LogicalModelEntity } from '../../domain/logical-model.entity';
import type { RoutingSnapshot } from '../../domain/runtime.port';
import { RoutingService } from '../routing.service';

const capabilities: ModelCapabilities = {
  contextWindow: 128_000,
  maxOutputTokens: 8_192,
  toolCall: true,
  imageInput: false,
  audioInput: false,
  structuredOutput: true,
  reasoning: false,
  embedding: false,
  streaming: true,
};

function snapshot(candidates: CandidateEntry[]): RoutingSnapshot {
  return {
    providers: new Map(),
    logicalByKey: new Map([
      ['chat-main', new LogicalModelEntity('logical', 'chat-main', true, 2)],
    ]),
    candidatesByLogical: new Map([['logical', candidates]]),
  };
}

describe('RoutingService', () => {
  it('产出 mastra 链并截断 maxAttempts', async () => {
    const candidates: CandidateEntry[] = [
      {
        id: 'candidate-a',
        logicalModelId: 'logical',
        providerId: 'provider-a',
        providerSlug: 'provider-a',
        providerModelId: 'model-a',
        priority: 1,
        enabled: true,
        capabilities,
        providerEnabled: true,
        providerHealth: 'healthy',
        providerOpenUntil: null,
      },
      {
        id: 'candidate-b',
        logicalModelId: 'logical',
        providerId: 'provider-b',
        providerSlug: 'provider-b',
        providerModelId: 'model-b',
        priority: 2,
        enabled: true,
        capabilities,
        providerEnabled: true,
        providerHealth: 'healthy',
        providerOpenUntil: null,
      },
    ];
    const service = new RoutingService(
      { get: async () => snapshot(candidates) },
      { allows: () => true },
    );
    await expect(service.resolveChain('chat-main', {})).resolves.toEqual([
      { id: 'candidate-a', model: 'cip/provider-a/model-a', maxRetries: 0 },
      { id: 'candidate-b', model: 'cip/provider-b/model-b', maxRetries: 0 },
    ]);
  });

  it('未知逻辑模型返回明确错误码', async () => {
    const service = new RoutingService(
      { get: async () => snapshot([]) },
      { allows: () => true },
    );
    await expect(service.resolveChain('missing', {})).rejects.toMatchObject({
      code: 'model.logical_model_not_found',
    });
  });
});
