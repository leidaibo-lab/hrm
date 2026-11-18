import { describe, expect, it } from 'vitest';
import type {
  AgentRegressionPort,
  AgentRegressionReport,
} from '../../domain/agent-regression.port';
import { Policy } from '../../domain/policy.entity';
import type { PolicyRepository } from '../../domain/policy.repository';
import { AgentRegressionService } from '../agent-regression.service';

const AT = new Date('2026-11-16T00:00:00.000Z');

const report: AgentRegressionReport = {
  agentKey: 'clarify',
  threshold: 0.8,
  score: 0.9,
  passed: true,
  cases: [],
  ranAt: AT.toISOString(),
};

function makeService(options?: {
  threshold?: number;
  passed?: boolean;
}): AgentRegressionService {
  const port: AgentRegressionPort = {
    run: async (input) => ({
      ...report,
      threshold: input.threshold,
      passed: options?.passed ?? true,
    }),
  };
  const policies = {
    findCurrent: async () =>
      Policy.create({
        id: 'policy-1',
        version: 1,
        acceptMode: 'explicit',
        rules:
          options?.threshold === undefined
            ? {}
            : { regressionThreshold: options.threshold },
        createdBy: 'admin',
        now: AT,
      }),
  } as unknown as PolicyRepository;
  return new AgentRegressionService(port, policies);
}

describe('AgentRegressionService', () => {
  it('阈值取策略配置，显式值优先', async () => {
    const service = makeService({ threshold: 0.75 });
    await expect(service.run('clarify')).resolves.toMatchObject({
      threshold: 0.75,
    });
    await expect(service.run('clarify', 0.6)).resolves.toMatchObject({
      threshold: 0.6,
    });
  });

  it('未配置策略阈值时使用 0.8', async () => {
    const service = new AgentRegressionService(
      { run: async (input) => ({ ...report, threshold: input.threshold }) },
      { findCurrent: async () => null } as unknown as PolicyRepository,
    );
    await expect(service.run('clarify')).resolves.toMatchObject({
      threshold: 0.8,
    });
  });
});
