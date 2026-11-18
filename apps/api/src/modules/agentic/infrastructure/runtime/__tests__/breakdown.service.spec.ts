import { describe, expect, it } from 'vitest';
import type { GatewayExportService } from '../../../../model-providers/application/gateway-export.service';
import { Policy } from '../../../domain/policy.entity';
import { MastraBreakdownService } from '../breakdown.service';

const AT = new Date('2026-11-16T00:00:00.000Z');

class FailingGateway {
  async createGateway(): Promise<never> {
    throw new Error('未配置供应商');
  }
}

class StubRepository {
  async findById(): Promise<null> {
    return null;
  }
  async listByTicket(): Promise<[]> {
    return [];
  }
  async list(): Promise<[]> {
    return [];
  }
  async listByThread(): Promise<[]> {
    return [];
  }
  async listOpenByTicket(): Promise<[]> {
    return [];
  }
  async findLatest(): Promise<null> {
    return null;
  }
  async listByKey(): Promise<[]> {
    return [];
  }
}

function makeService(): MastraBreakdownService {
  const repo = new StubRepository();
  return new MastraBreakdownService(
    new FailingGateway() as unknown as GatewayExportService,
    {} as never,
    repo as never,
    repo as never,
    repo as never,
    repo as never,
    repo as never,
    repo as never,
    repo as never,
    repo as never,
  );
}

function makePolicy(rules: unknown): Policy {
  return Policy.create({
    id: 'policy-1',
    version: 1,
    acceptMode: 'explicit',
    rules,
    createdBy: 'admin',
    now: AT,
  });
}

describe('MastraBreakdownService', () => {
  it('策略未配置模型路由时抛错', async () => {
    await expect(
      makeService().breakdown({
        ticketId: 'ticket-1',
        threadId: 'thread-1',
        triggers: [],
        policy: makePolicy({}),
      }),
    ).rejects.toThrow('mainModel/assessmentModel');
  });

  it('网关构建失败时抛错，不吞掉失败', async () => {
    await expect(
      makeService().breakdown({
        ticketId: 'ticket-1',
        threadId: 'thread-1',
        triggers: [],
        policy: makePolicy({ mainModel: 'cip/provider/model' }),
      }),
    ).rejects.toThrow('未配置供应商');
  });
});
