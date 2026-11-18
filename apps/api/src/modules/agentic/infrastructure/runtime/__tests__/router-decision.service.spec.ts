import { describe, expect, it } from 'vitest';
import type { GatewayExportService } from '../../../../model-providers/application/gateway-export.service';
import { Policy } from '../../../domain/policy.entity';
import { Trigger } from '../../../domain/trigger.entity';
import { MastraRouterDecisionService } from '../router-decision.service';

const AT = new Date('2026-11-16T00:00:00.000Z');

function trigger(): Trigger {
  return Trigger.create({
    id: 'trigger-1',
    dedupeKey: 'lark:1',
    sourceType: 'lark',
    instanceId: 'instance-1',
    threadId: 'thread-1',
    actorId: 'actor-1',
    text: '需求内容',
    payload: {},
    occurredAt: AT,
  });
}

function policy(rules: Record<string, unknown>): Policy {
  return Policy.create({
    id: 'policy-1',
    version: 1,
    acceptMode: 'explicit',
    rules,
    createdBy: 'admin',
    now: AT,
  });
}

describe('MastraRouterDecisionService', () => {
  it('未配置 fast/main 模型时返回 null', async () => {
    const service = new MastraRouterDecisionService({
      createGateway: async () => {
        throw new Error('不应调用');
      },
    } as unknown as GatewayExportService);

    await expect(
      service.decide({
        threadId: 'thread-1',
        triggers: [trigger()],
        policy: policy({}),
      }),
    ).resolves.toBeNull();
  });

  it('网关失败时返回 null，回退确定性路由', async () => {
    const service = new MastraRouterDecisionService({
      createGateway: async () => {
        throw new Error('网关不可用');
      },
    } as unknown as GatewayExportService);

    await expect(
      service.decide({
        threadId: 'thread-1',
        triggers: [trigger()],
        policy: policy({ fastModel: 'cip/openai/gpt-4.1-mini' }),
      }),
    ).resolves.toBeNull();
  });
});
