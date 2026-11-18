import { describe, expect, it } from 'vitest';
import { AdmissionRule } from '../../domain/admission-rule.entity';
import type { AdmissionRuleRepository } from '../../domain/admission-rule.repository';
import { Policy } from '../../domain/policy.entity';
import type { PolicyRepository } from '../../domain/policy.repository';
import { AdmissionService } from '../admission.service';

const AT = new Date('2026-11-16T00:00:00.000Z');
const POLICY = Policy.create({
  id: 'policy-1',
  version: 3,
  acceptMode: 'explicit',
  rules: {},
  createdBy: 'admin',
  now: AT,
});

class FakePolicyRepository implements PolicyRepository {
  constructor(private readonly current: Policy | null) {}

  async findById(id: string): Promise<Policy | null> {
    return this.current?.id === id ? this.current : null;
  }

  async findCurrent(): Promise<Policy | null> {
    return this.current;
  }

  async findByVersion(version: number): Promise<Policy | null> {
    return this.current?.version === version ? this.current : null;
  }

  async create(): Promise<void> {}
}

class FakeAdmissionRuleRepository implements AdmissionRuleRepository {
  readonly rows: AdmissionRule[] = [];

  async listByPolicy(policyId: string): Promise<AdmissionRule[]> {
    return this.rows.filter((rule) => rule.policyId === policyId);
  }

  async find(input: {
    policyId: string;
    sourceInstanceId: string;
    scopeRow: string;
    cell: AdmissionRule['cell'];
  }): Promise<AdmissionRule | null> {
    return (
      this.rows.find(
        (rule) =>
          rule.policyId === input.policyId &&
          rule.sourceInstanceId === input.sourceInstanceId &&
          rule.scopeRow === input.scopeRow &&
          rule.cell === input.cell,
      ) ?? null
    );
  }

  async createMany(rules: AdmissionRule[]): Promise<void> {
    this.rows.push(...rules);
  }
}

function makeService(options: {
  policy: Policy | null;
  rules?: Array<{
    scopeRow: string;
    cell: AdmissionRule['cell'];
    allowed: boolean;
  }>;
}): AdmissionService {
  const rules = new FakeAdmissionRuleRepository();
  for (const [index, rule] of (options.rules ?? []).entries()) {
    rules.rows.push(
      AdmissionRule.create({
        id: `rule-${index}`,
        policyId: 'policy-1',
        sourceInstanceId: 'instance-1',
        scopeRow: rule.scopeRow,
        cell: rule.cell,
        allowed: rule.allowed,
        now: AT,
      }),
    );
  }
  return new AdmissionService(new FakePolicyRepository(options.policy), rules);
}

describe('AdmissionService.evaluate', () => {
  it('没有策略时拒绝', async () => {
    const service = makeService({ policy: null });
    const result = await service.evaluate({
      sourceInstanceId: 'instance-1',
      scopeRow: 'project-a',
      actorListed: true,
      addressed: true,
    });
    expect(result.admitted).toBe(false);
    expect(result.reason).toBe('no_policy');
  });

  it('名单内被点名直接通过', async () => {
    const service = makeService({ policy: POLICY });
    const result = await service.evaluate({
      sourceInstanceId: 'instance-1',
      scopeRow: 'project-a',
      actorListed: true,
      addressed: true,
    });
    expect(result.admitted).toBe(true);
    expect(result.cell).toBeNull();
  });

  it('名单内未点名按准入表判定', async () => {
    const service = makeService({
      policy: POLICY,
      rules: [
        { scopeRow: 'project-a', cell: 'listed_unaddressed', allowed: true },
      ],
    });
    const result = await service.evaluate({
      sourceInstanceId: 'instance-1',
      scopeRow: 'project-a',
      actorListed: true,
      addressed: false,
    });
    expect(result.admitted).toBe(true);
    expect(result.cell).toBe('listed_unaddressed');
  });

  it('名单外点名被拒绝', async () => {
    const service = makeService({
      policy: POLICY,
      rules: [
        { scopeRow: 'project-a', cell: 'unlisted_addressed', allowed: false },
      ],
    });
    const result = await service.evaluate({
      sourceInstanceId: 'instance-1',
      scopeRow: 'project-a',
      actorListed: false,
      addressed: true,
    });
    expect(result.admitted).toBe(false);
    expect(result.reason).toBe('denied');
  });

  it('未显式传 actorListed 时从策略名单解析', async () => {
    const listedPolicy = Policy.create({
      id: 'policy-1',
      version: 3,
      acceptMode: 'explicit',
      rules: { allowedActors: ['open-id-1'] },
      createdBy: 'admin',
      now: AT,
    });
    const service = makeService({
      policy: listedPolicy,
      rules: [
        { scopeRow: 'project-a', cell: 'listed_unaddressed', allowed: true },
      ],
    });

    const result = await service.evaluate({
      sourceInstanceId: 'instance-1',
      scopeRow: 'project-a',
      actorId: 'open-id-1',
      addressed: false,
    });

    expect(result.admitted).toBe(true);
    expect(result.cell).toBe('listed_unaddressed');
  });

  it('名单外成员按 unlisted 单元格判定', async () => {
    const listedPolicy = Policy.create({
      id: 'policy-1',
      version: 3,
      acceptMode: 'explicit',
      rules: { allowedActors: ['open-id-1'] },
      createdBy: 'admin',
      now: AT,
    });
    const service = makeService({
      policy: listedPolicy,
      rules: [
        { scopeRow: 'project-a', cell: 'unlisted_unaddressed', allowed: false },
      ],
    });

    const result = await service.evaluate({
      sourceInstanceId: 'instance-1',
      scopeRow: 'project-a',
      actorId: 'open-id-2',
      addressed: false,
    });

    expect(result.admitted).toBe(false);
    expect(result.cell).toBe('unlisted_unaddressed');
  });
  it('缺少对应单元格规则时拒绝', async () => {
    const service = makeService({ policy: POLICY });
    const result = await service.evaluate({
      sourceInstanceId: 'instance-1',
      scopeRow: 'project-a',
      actorListed: false,
      addressed: false,
    });
    expect(result.reason).toBe('no_rule');
  });
});
