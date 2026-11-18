import { readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  apiViolations,
  type SourceNode,
  sourceGraph,
} from '../../../../scripts/checks/lib/source-graph.js';

/**
 * 架构约束（机器可判定部分）：
 * 1) 文件命名：目录 ↔ 角色白名单，guard 与 barrel 位置收紧；
 * 2) 依赖方向：domain 禁框架与第三方 SDK、platform/pipeline 禁业务、application 禁 infrastructure/dto/pipeline、接入层禁 infrastructure；
 * 3) 模块边界：跨模块只经 application 服务或对方模块入口。
 * 新增文件、目录或跨模块依赖若越界，本测试失败。
 */
// vitest 在 package 目录启动：cwd = apps/api
const SRC = resolve(process.cwd(), 'src');

const TEST_FILE = /\.(spec|fixture)\.ts$/;

const MODULE_DOMAIN_SUFFIXES = [
  '.entity.ts',
  '.repository.ts',
  '.port.ts',
  '.error.ts',
];
const MODULE_INFRA_SUFFIXES = [
  '.repository.ts',
  '.mapper.ts',
  '.service.ts',
  '.helper.ts',
  '.interceptor.ts',
];
/** runtime 执行角色（4 项，全局封闭）：仅 modules/<域>/infrastructure/runtime/ 的固定子目录允许（ADR-0044）。 */
const RUNTIME_ROLES = ['.agent.ts', '.workflow.ts', '.tool.ts', '.scorer.ts'];
const RUNTIME_DIRS = ['agents', 'workflows', 'tools', 'scorers'];
const PIPELINE_ROLES: Record<string, string[]> = {
  audit: ['.decorator.ts', '.interceptor.ts'],
  filters: ['.filter.ts'],
  guards: ['.guard.ts', '.decorator.ts', '.type.ts'],
  pipes: ['.pipe.ts'],
  'rate-limit': ['.module.ts', '.service.ts'],
  'call-context': ['.decorator.ts', '.helper.ts', '.interceptor.ts'],
};

/** 白名单之外仅允许的根级入口与配置。 */
const ROOT_EXEMPTIONS = [
  'main.ts',
  'worker.ts',
  'app.module.ts',
  'worker.module.ts',
  'config/env.ts',
];

/** platform 显式登记的无状态策略/纯函数文件（不套 <cap>.service.ts 命名）。 */
const PLATFORM_EXTRA_FILES = new Set(['platform/http/outbound-policy.ts']);

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.name.endsWith('.ts'))
      acc.push(relative(SRC, full).split('\\').join('/'));
  }
  return acc;
}

const FILES = walk(SRC);

function endsWithAny(name: string, suffixes: string[]): boolean {
  return suffixes.some((suffix) => name.endsWith(suffix));
}

/** 文件在目录角色白名单内返回 true。 */
function isAllowed(rel: string): boolean {
  if (/^platform\/prisma\/generated\//.test(rel)) return true;
  const parts = rel.split('/');
  const name = parts[parts.length - 1];
  if (!/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*\.ts$/.test(name)) return false;
  const segments = name.split('.');
  if (segments.length > 4 && !TEST_FILE.test(name)) return false;
  if (
    segments.length === 4 &&
    !['prisma', 'redis', 'memory'].includes(segments[1]) &&
    !TEST_FILE.test(name)
  )
    return false;

  // 测试文件：任意层级必须位于 __tests__ 且为 spec/fixture
  if (TEST_FILE.test(name)) return parts.includes('__tests__');

  // 入口与配置：仅显式豁免集允许位于白名单目录之外
  if (ROOT_EXEMPTIONS.includes(rel)) return true;

  // barrel 仅限子域入口：platform/<cap>/、pipeline/<机制>/、openapi/、testing/
  if (name === 'index.ts') {
    const isSubdomainBarrel =
      (parts[0] === 'platform' || parts[0] === 'pipeline') &&
      parts.length === 3;
    const isTopLevelBarrel =
      (parts[0] === 'openapi' || parts[0] === 'testing') && parts.length === 2;
    return isSubdomainBarrel || isTopLevelBarrel;
  }

  // platform/<cap>/<cap>.module.ts|<cap>.service.ts，另含显式登记的无状态策略文件
  if (parts[0] === 'platform') {
    if (parts.length !== 3) return false;
    return (
      name === `${parts[1]}.module.ts` ||
      name === `${parts[1]}.service.ts` ||
      PLATFORM_EXTRA_FILES.has(rel)
    );
  }

  // openapi/：纯函数 helper
  if (parts[0] === 'openapi')
    return parts.length === 2 && name.endsWith('.helper.ts');

  // testing/：测试辅助
  if (parts[0] === 'testing') {
    return (
      parts.length === 2 && endsWithAny(name, ['.helper.ts', '.fixture.ts'])
    );
  }

  // pipeline/<机制>/<角色>
  if (parts[0] === 'pipeline') {
    if (parts.length !== 3) return false;
    return endsWithAny(name, PIPELINE_ROLES[parts[1]] ?? []);
  }

  // modules/<域>/...
  if (parts[0] !== 'modules' || parts.length < 3) return false;
  const domain = parts[1];
  const depth = parts.length;
  if (depth === 3) {
    return (
      name === `${domain}.module.ts` ||
      name.endsWith('.controller.ts') ||
      name === `${domain}.guard.ts`
    );
  }
  if (depth === 4) {
    switch (parts[2]) {
      case 'dto':
        return name.endsWith('.dto.ts');
      case 'application':
        return name.endsWith('.service.ts');
      case 'domain':
        return endsWithAny(name, MODULE_DOMAIN_SUFFIXES);
      case 'infrastructure':
        return endsWithAny(name, MODULE_INFRA_SUFFIXES);
      default:
        return false;
    }
  }
  if (depth >= 5 && parts[2] === 'infrastructure') {
    if (endsWithAny(name, MODULE_INFRA_SUFFIXES)) return true;
    return (
      parts[3] === 'runtime' &&
      depth >= 6 &&
      RUNTIME_DIRS.includes(parts[4]) &&
      endsWithAny(name, RUNTIME_ROLES)
    );
  }
  return false;
}

describe('架构约束：文件命名', () => {
  it('所有源文件都在目录角色白名单内', () => {
    expect(FILES.filter((rel) => !isAllowed(rel))).toEqual([]);
  });
});

describe('架构约束：runtime 执行角色边界（两层封闭表）', () => {
  it.each([
    'modules/agentic/application/clarify.agent.ts',
    'modules/agentic/infrastructure/runtime/clarify.saga.ts',
    'modules/agentic/infrastructure/runtime/agents/clarify.worker.ts',
    'modules/connector/infrastructure/lark/lark.card.ts',
  ])('拒绝越界或自定义后缀：%s', (rel) => {
    expect(isAllowed(rel)).toBe(false);
  });

  it.each([
    'modules/agentic/infrastructure/runtime/agents/clarify.agent.ts',
    'modules/agentic/infrastructure/runtime/workflows/clarify.workflow.ts',
    'modules/connector/infrastructure/runtime/tools/sync.tool.ts',
    'modules/connector/infrastructure/runtime/scorers/sync.scorer.ts',
  ])('允许跨域共用的 runtime 角色：%s', (rel) => {
    expect(isAllowed(rel)).toBe(true);
  });
});

const violations = apiViolations(
  sourceGraph(SRC, resolve(SRC, '../tsconfig.json')),
);
describe('架构约束：单一依赖图', () => {
  for (const rule of [
    'ARC-4.2',
    'ARC-5.1',
    'ARC-5.2',
    'ARC-5.3',
    'ARC-5.4',
    'ARC-5.5',
    'ARC-5.6',
  ]) {
    it(`${rule} 依赖约束`, () => {
      expect(violations.filter((message) => message.startsWith(rule))).toEqual(
        [],
      );
    });
  }
  it('完整图无未知导入、循环或其他结构违规', () => {
    expect(violations).toEqual([]);
  });
});

const edge = (
  file: string,
  target: string,
  specifier = target,
): SourceNode => ({
  file,
  source: '',
  imports: [{ specifier, target, names: [] }],
});
describe('依赖规则回归：合法与违规边界', () => {
  it.each([
    [
      'ARC-5.1',
      'platform/http/http.service.ts',
      'modules/iam/application/user.service.ts',
    ],
    ['ARC-5.1', 'platform/http/http.service.ts', 'pipeline/guards/index.ts'],
    ['ARC-5.1', 'platform/http/http.service.ts', 'openapi/index.ts'],
    ['ARC-5.1', 'platform/http/http.service.ts', 'testing/index.ts'],
    [
      'ARC-5.1',
      'pipeline/guards/policies.guard.ts',
      'modules/iam/application/user.service.ts',
    ],
    [
      'ARC-5.2',
      'modules/iam/application/user.service.ts',
      'modules/iam/infrastructure/user.prisma.repository.ts',
    ],
    [
      'ARC-5.2',
      'modules/iam/application/user.service.ts',
      'modules/iam/dto/user.dto.ts',
    ],
    [
      'ARC-5.2',
      'modules/iam/application/user.service.ts',
      'pipeline/guards/index.ts',
    ],
    [
      'ARC-5.2',
      'modules/iam/application/user.service.ts',
      'modules/iam/user.controller.ts',
    ],
    [
      'ARC-5.2',
      'modules/iam/application/user.service.ts',
      'modules/iam/iam.module.ts',
    ],
    [
      'ARC-5.3',
      'modules/iam/domain/user.entity.ts',
      'modules/iam/application/user.service.ts',
    ],
    [
      'ARC-5.3',
      'modules/iam/domain/user.entity.ts',
      'modules/iam/infrastructure/user.prisma.repository.ts',
    ],
    [
      'ARC-5.3',
      'modules/iam/domain/user.entity.ts',
      'modules/iam/dto/user.dto.ts',
    ],
    [
      'ARC-5.3',
      'modules/iam/domain/user.entity.ts',
      'pipeline/guards/index.ts',
    ],
    [
      'ARC-5.5',
      'modules/iam/user.controller.ts',
      'modules/iam/domain/user.entity.ts',
    ],
    [
      'ARC-5.5',
      'modules/iam/user.controller.ts',
      'modules/iam/infrastructure/user.prisma.repository.ts',
    ],
    [
      'ARC-5.5',
      'modules/iam/dto/user.dto.ts',
      'modules/iam/application/user.service.ts',
    ],
    [
      'ARC-5.5',
      'modules/iam/dto/user.dto.ts',
      'modules/iam/domain/user.entity.ts',
    ],
    [
      'ARC-5.5',
      'modules/iam/dto/user.dto.ts',
      'modules/iam/infrastructure/user.prisma.repository.ts',
    ],
    ['ARC-5.5', 'modules/iam/dto/user.dto.ts', 'pipeline/guards/index.ts'],
    [
      'ARC-5.6',
      'modules/iam/infrastructure/user.prisma.repository.ts',
      'modules/iam/application/user.service.ts',
    ],
    [
      'ARC-5.6',
      'modules/iam/infrastructure/user.prisma.repository.ts',
      'modules/iam/dto/user.dto.ts',
    ],
    [
      'ARC-5.6',
      'modules/iam/infrastructure/user.prisma.repository.ts',
      'modules/iam/user.controller.ts',
    ],
    [
      'ARC-5.4',
      'modules/auth/infrastructure/local-password.service.ts',
      'modules/iam/domain/user.entity.ts',
    ],
    [
      'ARC-4.2',
      'modules/iam/application/user.service.ts',
      'platform/http/http.service.ts',
    ],
  ])('%s 拒绝 %s → %s', (rule, file, target) => {
    expect(
      apiViolations([edge(file, target)]).some((message) =>
        message.startsWith(rule),
      ),
    ).toBe(true);
  });
  it.each([
    '@nestjs/common',
    '@prisma/client',
    '@mastra/core/llm',
    '@ai-sdk/provider',
  ])('domain 拒绝外部技术包 %s', (specifier) => {
    expect(
      apiViolations([
        {
          file: 'modules/iam/domain/user.entity.ts',
          source: '',
          imports: [{ specifier, names: [], target: null }],
        },
      ]).join(),
    ).toContain('ARC-5.3');
  });
  it.each([
    [
      'modules/iam/application/user.service.ts',
      'modules/iam/domain/user.repository.ts',
    ],
    [
      'modules/iam/infrastructure/user.prisma.repository.ts',
      'modules/iam/domain/user.repository.ts',
    ],
    [
      'modules/iam/user.controller.ts',
      'modules/iam/application/user.service.ts',
    ],
    ['modules/iam/application/user.service.ts', 'platform/http/index.ts'],
    ['platform/http/http.service.ts', 'config/env.ts'],
    ['pipeline/guards/policies.guard.ts', 'platform/redis/index.ts'],
  ])('允许合法依赖 %s → %s', (file, target) => {
    expect(apiViolations([edge(file, target)])).toEqual([]);
  });
});
