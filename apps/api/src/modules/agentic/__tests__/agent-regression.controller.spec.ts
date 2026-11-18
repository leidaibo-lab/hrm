import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { AgentRegressionController } from '../agent-regression.controller';
import {
  AgentRegressionService,
  AgentRegressionUnavailableError,
  AgentRegressionUnsupportedError,
} from '../application/agent-regression.service';

const report = {
  agentKey: 'clarify',
  threshold: 0.8,
  score: 0.9,
  passed: true,
  cases: [],
  ranAt: new Date('2026-11-16T00:00:00.000Z').toISOString(),
};

function makeController(error?: Error): AgentRegressionController {
  return new AgentRegressionController({
    run: async () => {
      if (error) throw error;
      return report;
    },
  } as unknown as AgentRegressionService);
}

describe('AgentRegressionController.run', () => {
  it('返回回归报告', async () => {
    await expect(makeController().run('clarify', {})).resolves.toEqual(report);
  });

  it('未知角色映射为 400', async () => {
    await expect(
      makeController(new AgentRegressionUnsupportedError('assess')).run(
        'assess',
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('依赖不可用映射为 503', async () => {
    await expect(
      makeController(new AgentRegressionUnavailableError('模型不可用')).run(
        'clarify',
        {},
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
