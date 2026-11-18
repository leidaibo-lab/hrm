import { describe, expect, it } from 'vitest';
import { Policy } from '../../domain/policy.entity';
import type { PolicyRepository } from '../../domain/policy.repository';
import { RoutingRolloutService } from '../routing-rollout.service';

const AT = new Date('2026-11-16T00:00:00.000Z');

function makeService(rules: unknown): RoutingRolloutService {
  return new RoutingRolloutService({
    findCurrent: async () =>
      Policy.create({
        id: 'policy-1',
        version: 1,
        acceptMode: 'explicit',
        rules,
        createdBy: 'admin',
        now: AT,
      }),
  } as unknown as PolicyRepository);
}

const input = { sourceType: 'lark', scopeKey: 'project-a' };

describe('RoutingRolloutService', () => {
  it('无规则或策略缺失时默认启用', async () => {
    await expect(makeService({}).asyncEnabled(input)).resolves.toBe(true);
    const empty = new RoutingRolloutService({
      findCurrent: async () => null,
    } as unknown as PolicyRepository);
    await expect(empty.asyncEnabled(input)).resolves.toBe(true);
  });

  it('enabled=false 全局回退', async () => {
    await expect(
      makeService({ routingRollout: { enabled: false } }).asyncEnabled(input),
    ).resolves.toBe(false);
  });

  it('按来源与项目白名单灰度', async () => {
    const service = makeService({
      routingRollout: { sources: ['lark'], scopeKeys: ['project-a'] },
    });
    await expect(service.asyncEnabled(input)).resolves.toBe(true);
    await expect(
      service.asyncEnabled({ sourceType: 'zentao', scopeKey: 'project-a' }),
    ).resolves.toBe(false);
    await expect(
      service.asyncEnabled({ sourceType: 'lark', scopeKey: 'project-b' }),
    ).resolves.toBe(false);
  });

  it('按角色与工单维度灰度并给出未命中原因', async () => {
    const service = makeService({
      routingRollout: {
        roles: ['clarify'],
        ticketIds: ['ticket-1'],
      },
    });

    await expect(
      service.decide({
        ...input,
        role: 'clarify',
        ticketId: 'ticket-1',
      }),
    ).resolves.toMatchObject({ enabled: true, configured: true, reasons: [] });

    await expect(
      service.decide({ ...input, role: 'assess', ticketId: 'ticket-1' }),
    ).resolves.toMatchObject({
      enabled: false,
      reasons: ['role_not_matched'],
    });

    await expect(
      service.decide({ ...input, role: 'clarify', ticketId: 'ticket-2' }),
    ).resolves.toMatchObject({
      enabled: false,
      reasons: ['ticket_not_matched'],
    });
  });

  it('无规则时不写审计标记', async () => {
    await expect(makeService({}).decide(input)).resolves.toMatchObject({
      enabled: true,
      configured: false,
    });
  });
});
