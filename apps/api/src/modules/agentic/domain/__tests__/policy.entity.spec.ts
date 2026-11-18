import { describe, expect, it } from 'vitest';
import {
  isActorListed,
  Policy,
  readPermissionWindow,
  readPolicyRules,
} from '../policy.entity';

const AT = new Date('2026-11-16T00:00:00.000Z');

const base = {
  id: 'policy-1',
  version: 7,
  acceptMode: 'explicit' as const,
  rules: { allowedUsers: ['open-id-1'] },
  createdBy: 'admin',
  now: AT,
};

describe('Policy 聚合', () => {
  it('创建后记录版本与规则', () => {
    const policy = Policy.create(base);
    expect(policy.version).toBe(7);
    expect(policy.acceptMode).toBe('explicit');
    expect(policy.rules).toEqual(base.rules);
  });

  it('版本必须为正整数', () => {
    expect(() => Policy.create({ ...base, version: 0 })).toThrow(
      '策略版本必须为正整数',
    );
  });

  it('创建人不能为空', () => {
    expect(() => Policy.create({ ...base, createdBy: '  ' })).toThrow(
      '策略创建人不能为空',
    );
  });

  it('规则不能为空', () => {
    expect(() => Policy.create({ ...base, rules: null })).toThrow(
      '策略规则不能为空',
    );
  });

  it('快照可重建等价聚合', () => {
    const policy = Policy.create(base);
    const restored = Policy.rehydrate(policy.toSnapshot());
    expect(restored.toSnapshot()).toEqual(policy.toSnapshot());
  });
});

describe('策略规则解析', () => {
  it('读取名单与模型路由', () => {
    const rules = readPolicyRules({
      allowedActors: ['open-id-1'],
      allowedUsers: ['user-1'],
      assessmentModel: 'cip/provider/model',
      extra: true,
    });
    expect(rules.allowedActors).toEqual(['open-id-1']);
    expect(rules.allowedUsers).toEqual(['user-1']);
    expect(rules.assessmentModel).toBe('cip/provider/model');
  });

  it('解析单次运行超时，非法值忽略', () => {
    expect(readPolicyRules({ runTimeoutMs: 30_000 }).runTimeoutMs).toBe(30_000);
    expect(readPolicyRules({ runTimeoutMs: 500 }).runTimeoutMs).toBe(undefined);
    expect(readPolicyRules({ runTimeoutMs: 700_000 }).runTimeoutMs).toBe(
      undefined,
    );
    expect(readPolicyRules({ runTimeoutMs: '30' }).runTimeoutMs).toBe(
      undefined,
    );
  });

  it('解析 token 预算，非法值忽略', () => {
    expect(readPolicyRules({ runTokenBudget: 50_000 }).runTokenBudget).toBe(
      50_000,
    );
    expect(readPolicyRules({ runTokenBudget: 500 }).runTokenBudget).toBe(
      undefined,
    );
    expect(readPolicyRules({ runTokenBudget: 'x' }).runTokenBudget).toBe(
      undefined,
    );
  });

  it('非对象负载返回空规则', () => {
    expect(readPolicyRules(null)).toEqual({});
    expect(readPolicyRules('bad')).toEqual({});
  });

  it('名单命中判断源内成员与平台用户', () => {
    const rules = { allowedActors: ['open-id-1'], allowedUsers: ['user-1'] };
    expect(isActorListed(rules, 'open-id-1')).toBe(true);
    expect(isActorListed(rules, 'user-1')).toBe(true);
    expect(isActorListed(rules, 'other')).toBe(false);
  });
});

describe('readPermissionWindow', () => {
  const rules = {
    permissionWindow: {
      start: '09:00',
      end: '19:00',
      timezone: 'Asia/Shanghai',
    },
  };

  it('窗口内返回当日边界', () => {
    const window = readPermissionWindow(
      rules,
      new Date('2026-11-16T02:00:00.000Z'),
    );
    expect(window?.from?.toISOString()).toBe('2026-11-16T01:00:00.000Z');
    expect(window?.to?.toISOString()).toBe('2026-11-16T11:00:00.000Z');
  });

  it('窗口过期返回已过去的终点', () => {
    const window = readPermissionWindow(
      rules,
      new Date('2026-11-16T12:30:00.000Z'),
    );
    expect(window?.to?.toISOString()).toBe('2026-11-16T11:00:00.000Z');
  });

  it('星期过滤排除当天时给出未来起点', () => {
    const window = readPermissionWindow(
      { permissionWindow: { ...rules.permissionWindow, days: [2] } },
      new Date('2026-11-16T02:00:00.000Z'),
    );
    expect(window?.from?.getTime()).toBeGreaterThan(
      new Date('2026-11-16T02:00:00.000Z').getTime(),
    );
  });

  it('跨夜窗口在凌晨仍有效', () => {
    const window = readPermissionWindow(
      {
        permissionWindow: {
          start: '22:00',
          end: '06:00',
          timezone: 'Asia/Shanghai',
        },
      },
      new Date('2026-11-15T19:00:00.000Z'),
    );
    expect(window?.from?.toISOString()).toBe('2026-11-15T14:00:00.000Z');
    expect(window?.to?.toISOString()).toBe('2026-11-15T22:00:00.000Z');
  });

  it('配置非法时 fail closed', () => {
    const window = readPermissionWindow(
      {
        permissionWindow: {
          start: '25:00',
          end: '19:00',
          timezone: 'Asia/Shanghai',
        },
      },
      new Date('2026-11-16T02:00:00.000Z'),
    );
    expect(window?.from?.getTime()).toBeGreaterThan(
      new Date('2026-11-16T02:00:00.000Z').getTime(),
    );
  });

  it('缺少配置时不限制', () => {
    expect(readPermissionWindow({}, AT)).toBeUndefined();
    expect(readPermissionWindow(null, AT)).toBeUndefined();
  });
});
