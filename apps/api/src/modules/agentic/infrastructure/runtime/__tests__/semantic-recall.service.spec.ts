import { describe, expect, it } from 'vitest';
import type { GatewayExportService } from '../../../../model-providers/application/gateway-export.service';
import type { Policy } from '../../../domain/policy.entity';
import { Policy as PolicyAggregate } from '../../../domain/policy.entity';
import type { PolicyRepository } from '../../../domain/policy.repository';
import { MastraSemanticRecallService } from '../semantic-recall.service';

const AT = new Date('2026-11-16T00:00:00.000Z');

function makeService(options?: {
  rules?: Record<string, unknown> | null;
  gatewayFails?: boolean;
}): MastraSemanticRecallService {
  const policy =
    options?.rules === null
      ? null
      : PolicyAggregate.create({
          id: 'policy-1',
          version: 1,
          acceptMode: 'explicit',
          rules: options?.rules ?? {},
          createdBy: 'admin',
          now: AT,
        });
  return new MastraSemanticRecallService(
    {
      createGateway: async () => {
        if (options?.gatewayFails) throw new Error('网关不可用');
        throw new Error('测试未提供模型');
      },
    } as unknown as GatewayExportService,
    {
      findCurrent: async () => policy as Policy | null,
    } as unknown as PolicyRepository,
  );
}

describe('MastraSemanticRecallService', () => {
  it('没有策略或模型路由时返回 null，由调用方降级', async () => {
    await expect(
      makeService({ rules: null }).rank({
        query: '登录',
        candidates: [{ id: 'thread-1', text: '登录失败' }],
      }),
    ).resolves.toBeNull();
    await expect(
      makeService({ rules: {} }).rank({
        query: '登录',
        candidates: [{ id: 'thread-1', text: '登录失败' }],
      }),
    ).resolves.toBeNull();
  });

  it('网关失败时返回 null，不向调用方抛错', async () => {
    await expect(
      makeService({
        rules: { fastModel: 'cip/openai/gpt-4.1-mini' },
        gatewayFails: true,
      }).rank({
        query: '登录',
        candidates: [{ id: 'thread-1', text: '登录失败' }],
      }),
    ).resolves.toBeNull();
  });

  it('空候选直接返回空映射', async () => {
    await expect(
      makeService({ rules: {} }).rank({ query: '登录', candidates: [] }),
    ).resolves.toEqual({});
  });
});
