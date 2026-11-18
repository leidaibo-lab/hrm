import { describe, expect, it } from 'vitest';
import type { GatewayExportService } from '../../../../model-providers/application/gateway-export.service';
import { Policy } from '../../../domain/policy.entity';
import { MastraAssessmentService } from '../assessment.service';

const AT = new Date('2026-11-16T00:00:00.000Z');

class FailingGateway {
  async createGateway(): Promise<never> {
    throw new Error('未配置供应商');
  }
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

function makeService(): MastraAssessmentService {
  return new MastraAssessmentService(
    new FailingGateway() as unknown as GatewayExportService,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

describe('MastraAssessmentService', () => {
  it('策略未配置模型路由时返回 unavailable', async () => {
    const result = await makeService().assess({
      threadId: 'thread-1',
      triggers: [],
      policy: makePolicy({}),
    });
    expect(result.kind).toBe('unavailable');
    expect(result.reason).toContain('assessmentModel');
  });

  it('网关构建失败时返回 unavailable，不抛出', async () => {
    const result = await makeService().assess({
      threadId: 'thread-1',
      triggers: [],
      policy: makePolicy({ assessmentModel: 'cip/provider/model' }),
    });
    expect(result.kind).toBe('unavailable');
    expect(result.reason).toBe('模型研判失败');
  });
});
