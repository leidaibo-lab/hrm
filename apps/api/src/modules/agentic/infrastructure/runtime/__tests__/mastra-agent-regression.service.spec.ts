import { describe, expect, it } from 'vitest';
import type { GatewayExportService } from '../../../../model-providers/application/gateway-export.service';
import type { PolicyRepository } from '../../../domain/policy.repository';
import {
  MastraAgentRegressionService,
  scoreKeywords,
} from '../mastra-agent-regression.service';

describe('scoreKeywords', () => {
  it('按命中比例返回覆盖率', () => {
    expect(scoreKeywords({ summary: '导出订单' }, ['导出', '订单'])).toBe(1);
    expect(scoreKeywords({ summary: '导出订单' }, ['导出', '项目'])).toBe(0.5);
    expect(scoreKeywords({ summary: '无关' }, ['导出'])).toBe(0);
  });

  it('空期望词返回 0', () => {
    expect(scoreKeywords({ summary: 'x' }, [])).toBe(0);
  });
});

describe('MastraAgentRegressionService', () => {
  it('未覆盖的角色直接报错', async () => {
    const service = new MastraAgentRegressionService(
      {} as GatewayExportService,
      { findCurrent: async () => null } as unknown as PolicyRepository,
    );
    await expect(
      service.run({ agentKey: 'assess', threshold: 0.8 }),
    ).rejects.toThrow('暂无可运行的回归用例');
  });

  it('缺少策略时拒绝运行', async () => {
    const service = new MastraAgentRegressionService(
      {} as GatewayExportService,
      { findCurrent: async () => null } as unknown as PolicyRepository,
    );
    await expect(
      service.run({ agentKey: 'clarify', threshold: 0.8 }),
    ).rejects.toThrow('缺少当前策略');
  });
});
