import { describe, expect, it } from 'vitest';
import type { AdmissionRule } from '../../domain/admission-rule.entity';
import type { AdmissionRuleRepository } from '../../domain/admission-rule.repository';
import type { Policy } from '../../domain/policy.entity';
import type { PolicyRepository } from '../../domain/policy.repository';
import { PolicyService } from '../policy.service';

const AT = new Date('2026-11-16T00:00:00.000Z');

class FakePolicyRepository implements PolicyRepository {
  readonly rows: Policy[] = [];
  async findById(id: string): Promise<Policy | null> {
    return this.rows.find((policy) => policy.id === id) ?? null;
  }
  async findCurrent(): Promise<Policy | null> {
    return (
      [...this.rows].sort((left, right) => right.version - left.version)[0] ??
      null
    );
  }
  async findByVersion(version: number): Promise<Policy | null> {
    return this.rows.find((policy) => policy.version === version) ?? null;
  }
  async create(policy: Policy): Promise<void> {
    this.rows.push(policy);
  }
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

function makeService(): {
  service: PolicyService;
  policies: FakePolicyRepository;
  rules: FakeAdmissionRuleRepository;
} {
  const policies = new FakePolicyRepository();
  const rules = new FakeAdmissionRuleRepository();
  return { service: new PolicyService(policies, rules), policies, rules };
}

const publishInput = {
  acceptMode: 'explicit' as const,
  rules: { allowedUsers: [] },
  createdBy: 'admin',
  now: AT,
};

describe('PolicyService', () => {
  it('首次发布版本为 1，之后递增', async () => {
    const { service } = makeService();
    const first = await service.publish(publishInput);
    const second = await service.publish(publishInput);
    expect(first.version).toBe(1);
    expect(second.version).toBe(2);
  });

  it('发布准入规则写入策略版本', async () => {
    const { service, rules } = makeService();
    const policy = await service.publish(publishInput);

    const created = await service.publishAdmissionRules(policy.id, [
      {
        sourceInstanceId: 'instance-1',
        scopeRow: 'project-a',
        cell: 'listed_unaddressed',
        allowed: true,
      },
    ]);

    expect(created).toHaveLength(1);
    expect(rules.rows).toHaveLength(1);
    expect(rules.rows[0].policyId).toBe(policy.id);
  });

  it('同一单元格重复发布被拒绝', async () => {
    const { service } = makeService();
    const policy = await service.publish(publishInput);
    const rule = {
      sourceInstanceId: 'instance-1',
      scopeRow: 'project-a',
      cell: 'listed_unaddressed' as const,
      allowed: true,
    };

    await expect(
      service.publishAdmissionRules(policy.id, [rule, rule]),
    ).rejects.toThrow('准入规则重复');
  });

  it('策略不存在时报错', async () => {
    const { service } = makeService();
    await expect(
      service.publishAdmissionRules('missing', [
        {
          sourceInstanceId: 'instance-1',
          scopeRow: 'project-a',
          cell: 'listed_unaddressed',
          allowed: true,
        },
      ]),
    ).rejects.toThrow('策略不存在');
  });
});
