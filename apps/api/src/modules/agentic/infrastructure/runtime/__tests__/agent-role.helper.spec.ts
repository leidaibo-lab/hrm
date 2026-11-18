import { describe, expect, it } from 'vitest';
import {
  AGENT_ROLES,
  getAgentRole,
  resolveModelRoute,
  resolveRoleRoute,
} from '../agent-role.helper';
import { BREAKDOWN_GOAL } from '../agents/breakdown.agent';
import { CLARIFY_GOAL } from '../agents/clarify.agent';

describe('agent role registry', () => {
  it('注册 PRD 五个角色且键唯一', () => {
    const keys = AGENT_ROLES.map((role) => role.key);
    expect(keys).toEqual([
      'router',
      'assess',
      'clarify',
      'breakdown',
      'watchdog',
    ]);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('每个角色声明模型档位与工具白名单', () => {
    for (const role of AGENT_ROLES) {
      expect(['fast', 'main', 'judge']).toContain(role.modelTier);
      expect(role.instructions.length).toBeGreaterThan(0);
      expect(Array.isArray(role.tools)).toBe(true);
    }
  });

  it('未知角色直接报错', () => {
    expect(() => getAgentRole('nope' as never)).toThrow('未知执行角色');
  });
});

describe('resolveModelRoute', () => {
  it('按档位优先取专属路由', () => {
    const rules = {
      fastModel: 'cip/p/fast',
      mainModel: 'cip/p/main',
      judgeModel: 'cip/p/judge',
    };
    expect(resolveModelRoute(rules, 'fast')).toBe('cip/p/fast');
    expect(resolveModelRoute(rules, 'main')).toBe('cip/p/main');
    expect(resolveModelRoute(rules, 'judge')).toBe('cip/p/judge');
  });

  it('缺省时按兼容顺序回落', () => {
    expect(resolveModelRoute({ assessmentModel: 'cip/p/assess' }, 'main')).toBe(
      'cip/p/assess',
    );
    expect(
      resolveModelRoute({ clarificationModel: 'cip/p/clarify' }, 'judge'),
    ).toBe('cip/p/clarify');
  });

  it('完全未配置时返回 null', () => {
    expect(resolveModelRoute({}, 'fast')).toBeNull();
    expect(resolveModelRoute({ fastModel: '  ' }, 'fast')).toBeNull();
  });
});

describe('执行角色的 Goal 配置', () => {
  it('澄清目标最多 3 轮，拆解目标最多 6 轮', () => {
    expect(CLARIFY_GOAL.maxRuns).toBe(3);
    expect(BREAKDOWN_GOAL.maxRuns).toBe(6);
  });

  it('目标与判定提示齐全，空话不进入配置', () => {
    for (const goal of [CLARIFY_GOAL, BREAKDOWN_GOAL]) {
      expect(goal.objective.length).toBeGreaterThan(10);
      expect(goal.judgePrompt.length).toBeGreaterThan(10);
    }
  });
});

describe('resolveRoleRoute', () => {
  it('已发布版本模型优先于策略档位', () => {
    expect(resolveRoleRoute('cip/policy/model', 'cip/version/model')).toBe(
      'cip/version/model',
    );
    expect(resolveRoleRoute('cip/policy/model', '  ')).toBe('cip/policy/model');
    expect(resolveRoleRoute(null, undefined)).toBeNull();
  });
});
