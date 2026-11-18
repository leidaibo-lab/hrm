import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  parseOptions,
  runChanged,
} from '../../../../scripts/checks/changed.js';
import {
  checkCode,
  isBusinessSource,
} from '../../../../scripts/checks/code-quality.js';
import { compareContracts } from '../../../../scripts/checks/contracts.js';
import {
  checkDatabase,
  checkMigration,
  checkMigrationRequired,
} from '../../../../scripts/checks/database.js';
import {
  attachDependencies,
  collectChanges,
  fingerprint,
  materializeIndex,
  readBefore,
  safePath,
} from '../../../../scripts/checks/lib/changes.js';
import {
  type ContextRule,
  parseContextRegistry,
} from '../../../../scripts/checks/lib/contexts.js';
import {
  createPlan,
  SaveCheckQueue,
} from '../../../../scripts/checks/lib/plan.js';

const rules = (source: string, file = 'apps/web/features/example/types.tsx') =>
  checkCode(file, source).map((d) => d.rule);

describe('编码规则：合法与违规不能互相替代', () => {
  it('识别多行 JSX，属性赋值和数据 null 不受单分支显示限制', () => {
    expect(rules(`const node = ready ? (\n<div />\n) : null;`)).not.toContain(
      'WEB-7.1',
    );
    expect(
      rules(
        `const node = <Box item={ready ? <div /> : null}>{ready ? (\n<div />\n) : null}</Box>;`,
      ),
    ).toEqual(['WEB-7.1']);
    expect(rules('const node = <Box>{!!error && <Error />}</Box>;')).toEqual(
      [],
    );
  });
  it('检查嵌套三元、非空断言与空 catch，保留合法数值比较', () => {
    expect(
      rules('const a = x ? y : z ? 1 : 2; const b = row!.id; try {} catch {}'),
    ).toEqual(['QLT-5.1', 'QLT-4.1', 'QLT-6.1']);
    expect(
      rules(
        'if (price !== null) show(price); const limit = options?.limit ?? 0;',
      ),
    ).toEqual([]);
    expect(rules('try { save(); } catch { return fallback; }')).toEqual([]);
  });
  it('注释引用检测不把字符串中的文档地址当成注释', () => {
    expect(
      rules(
        `const link = 'docs/conventions/forms.md'; const note = 'ADR-0014';`,
      ),
    ).toEqual([]);
    expect(
      rules('// ADR-0014\n/* docs/prd/example.md */\n// PRD F1\nconst a = 1;'),
    ).toEqual(['CMT-4.4', 'CMT-4.4', 'CMT-4.4']);
    // 括注并列合规：契约说明在场，编号只做并列溯源（CMT-4.4，治理口径见规范规则 13）
    expect(
      rules(
        '/** 白名单外字段与重复条件一律 400（contracts.md 路由与查询 4）。 */\nexport function plan() {}',
      ),
    ).toEqual([]);
    expect(
      rules('/** model 域（ADR-0015）。 */\nexport const GATEWAY_ID = 1;'),
    ).toEqual(['CMT-4.4']);
    expect(rules('// 失败时保留上一次成功结果。\nconst a = 1;')).toEqual([]);
  });
  it('公共声明必须关联真实 JSDoc，包括 default/async 声明', () => {
    expect(rules('/* 普通块 */\nexport async function run() {}')).toContain(
      'CMT-4.1',
    );
    expect(
      rules('/** 失败时返回空集合。 */\nexport default function find() {}'),
    ).toEqual([]);
    expect(
      rules('export default function Page() {}', 'apps/web/app/test/page.tsx'),
    ).toEqual([]);
  });
  it('逐项检查公开对象、联合、嵌套和方法，但不强迫推导类型重复注释', () => {
    expect(
      rules(
        '/** 配置。 */ export type Options = { /** 超时毫秒。 */ timeoutMs?: number; nested: { value: string }; run(): void };',
      ),
    ).toEqual(['CMT-4.5', 'CMT-4.5', 'CMT-4.5']);
    expect(
      rules(
        '/** 查询条件。 */ export type Query = { /** 固定文本分支。 */ kind: "text" } | { /** 固定数字分支。 */ kind: "number" };',
      ),
    ).toEqual([]);
    expect(rules('export type Input = z.infer<typeof schema>;')).toEqual([]);
    expect(rules('interface Internal { value: string }')).toEqual([]);
  });
  it('语法错误必须报告执行异常，不允许得到空结果', () => {
    expect(
      checkCode('bad.ts', 'const x = {').some((d) => d.kind === 'error'),
    ).toBe(true);
  });
  it('豁免限定精确目录，普通同名 ui 目录仍受约束', () => {
    expect(isBusinessSource('apps/web/components/ui/button.tsx')).toBe(false);
    expect(isBusinessSource('apps/web/features/ui/button.tsx')).toBe(true);
    expect(
      isBusinessSource('apps/api/src/platform/prisma/generated/client.ts'),
    ).toBe(false);
    expect(isBusinessSource('apps/api/src/modules/test/domain/a.ts')).toBe(
      true,
    );
  });
});

const contexts: ContextRule[] = [
  {
    context: 'iam',
    prefix: null,
    module: 'apps/api/src/modules/iam',
    reserved: false,
  },
  {
    context: 'agent',
    prefix: 'agent_',
    module: 'apps/api/src/modules/agentic',
    reserved: true,
  },
];
const legalModel = `// 域: iam\n/// 业务域实体，保留至资源删除。\nmodel Thing {\n  /// 主键。\n  id String @id\n  /// 归属资源。\n  ownerId String\n  owner Owner @relation(fields: [ownerId], references: [id], onDelete: Restrict)\n  @@map("things")\n}`;
describe('数据库规则：声明检查与行为证据分开', () => {
  it('接受明确模型，但仍输出人工与数据库验收要求', () => {
    const result = checkDatabase(legalModel, '', contexts);
    expect(result.filter((d) => d.kind !== 'review')).toEqual([]);
    expect(result.some((d) => d.kind === 'review')).toBe(true);
    expect(checkDatabase(legalModel, legalModel, contexts)).toEqual([]);
  });
  it('拒绝缺失主键、职责说明、映射和删除策略', () => {
    expect(
      checkDatabase(
        'model Thing {\n ownerId String\n owner Owner @relation(fields: [ownerId], references: [id])\n}',
        '',
        contexts,
      ).map((d) => d.rule),
    ).toEqual(['DB-4.1', 'DB-5.1', 'DB-REVIEW']);
  });
  it('域声明必须登记，表名必须符合登记前缀', () => {
    const rulesOf = (schema: string) =>
      checkDatabase(schema, '', contexts).map((d) => d.rule);
    expect(rulesOf(legalModel)).not.toContain('DB-4.2');
    const agentModel = legalModel
      .replace('// 域: iam', '// 域: agent')
      .replace('@@map("things")', '@@map("agent_things")');
    expect(rulesOf(agentModel)).not.toContain('DB-4.2');
    expect(
      rulesOf(legalModel.replace('@@map("things")', '@@map("agent_things")')),
    ).toContain('DB-4.2');
    expect(
      rulesOf(
        agentModel.replace('@@map("agent_things")', '@@map("ai_things")'),
      ),
    ).toContain('DB-4.2');
    expect(
      rulesOf(legalModel.replace('@@map("things")', '@@map("iam_things")')),
    ).toContain('DB-4.2');
    expect(rulesOf(legalModel.replace('// 域: iam', '// 域: crm'))).toContain(
      'DB-4.2',
    );
    expect(rulesOf(legalModel.replace('// 域: iam\n', ''))).toContain('DB-4.2');
  });
  it('登记表解析不到行必须失败，不静默放行', () => {
    expect(() => parseContextRegistry('| 上下文 | 前缀 |')).toThrow(
      '未解析到上下文登记表',
    );
  });
  it('拒绝重复普通索引，联合索引不同顺序不混为一项', () => {
    const duplicate = legalModel.replace(
      '@@map',
      '@@index([ownerId])\n @@index([ownerId])\n @@map',
    );
    expect(checkDatabase(duplicate, '', contexts).map((d) => d.rule)).toContain(
      'DB-6.1',
    );
    const different = legalModel.replace(
      '@@map',
      '@@index([ownerId, id])\n @@index([id, ownerId])\n @@map',
    );
    expect(
      checkDatabase(different, '', contexts).map((d) => d.rule),
    ).not.toContain('DB-6.1');
  });
  it('拒绝改写和删除已有迁移，危险新 DDL 必须人工审查', () => {
    expect(checkMigration('migration.sql', 'B', 'A')[0]?.kind).toBe(
      'violation',
    );
    expect(checkMigration('migration.sql', null, 'A')[0]?.kind).toBe(
      'violation',
    );
    expect(
      checkMigration(
        'migration.sql',
        'ALTER TABLE "t" DROP COLUMN "x";',
        null,
      )[0]?.kind,
    ).toBe('review');
    expect(
      checkMigration('migration.sql', 'CREATE TABLE "t" (id TEXT);', null),
    ).toEqual([]);
  });
});

function document(
  schema: Parameters<typeof compareContracts>[0] = {
    type: 'object',
    properties: { id: { type: 'string' } },
    required: ['id'],
  },
) {
  return {
    openapi: '3.1.0',
    paths: {
      '/items': {
        get: {
          responses: { '200': { content: { 'application/json': { schema } } } },
        },
      },
    },
  };
}
describe('契约兼容性：保守拦截改变旧客户端保证的变更', () => {
  it('接受相同文档与可选响应字段新增', () => {
    expect(compareContracts(document(), document())).toEqual([]);
    expect(
      compareContracts(
        document(),
        document({
          type: 'object',
          properties: { id: { type: 'string' }, title: { type: 'string' } },
          required: ['id'],
        }),
      ),
    ).toEqual([]);
  });
  it('拒绝字段移除、类型变化和响应必填保证减少', () => {
    expect(
      compareContracts(document(), document({ type: 'object', properties: {} }))
        .length,
    ).toBeGreaterThan(0);
    expect(
      compareContracts(
        document(),
        document({
          type: 'object',
          properties: { id: { type: 'number' } },
          required: ['id'],
        }),
      ).length,
    ).toBeGreaterThan(0);
  });
  it('拒绝旧端点移除、认证变化与伪造的空文档', () => {
    expect(
      compareContracts(document(), { openapi: '3.1.0', paths: {} })[0]?.message,
    ).toContain('端点被移除');
    expect(
      compareContracts(document(), {
        ...document(),
        security: [{ session: [] }],
      }).length,
    ).toBeGreaterThan(0);
    expect(compareContracts({}, {}).length).toBeGreaterThan(0);
  });
  it('请求枚举收紧失败，响应枚举扩展失败，反方向可以兼容', () => {
    const response = (values: string[]) =>
      document({ type: 'string', enum: values });
    expect(
      compareContracts(response(['a']), response(['a', 'b'])).length,
    ).toBeGreaterThan(0);
    expect(compareContracts(response(['a', 'b']), response(['a']))).toEqual([]);
    const request = (values: string[]) => ({
      openapi: '3.1.0',
      paths: {
        '/items': {
          post: {
            requestBody: {
              content: {
                'application/json': {
                  schema: { type: 'string', enum: values },
                },
              },
            },
            responses: {},
          },
        },
      },
    });
    expect(
      compareContracts(request(['a', 'b']), request(['a'])).length,
    ).toBeGreaterThan(0);
    expect(compareContracts(request(['a']), request(['a', 'b']))).toEqual([]);
  });
  it('解析本地引用并检查递归类型，拒绝无法解析的引用', () => {
    const recursive = (type: string) => ({
      ...document({ $ref: '#/components/schemas/Item' }),
      components: {
        schemas: {
          Item: {
            type: 'object',
            properties: {
              value: { type },
              next: { $ref: '#/components/schemas/Item' },
            },
          },
        },
      },
    });
    expect(compareContracts(recursive('string'), recursive('string'))).toEqual(
      [],
    );
    expect(
      compareContracts(recursive('string'), recursive('number')).length,
    ).toBeGreaterThan(0);
    expect(() =>
      compareContracts(document({ $ref: '#/missing' }), document()),
    ).toThrow('引用无法解析');
  });
});

/** 测试内 git 必须清除父进程 GIT_* 变量，避免 hook 环境下把 fixture 提交写进真实仓库。 */
function fixtureEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of [
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_INDEX_FILE',
    'GIT_PREFIX',
    'GIT_COMMON_DIR',
  ]) {
    delete env[key];
  }
  return env;
}

/** pre-commit 会注入 GIT_*；fixture 仓库的所有 git 调用必须在干净环境下执行。 */
for (const key of [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_PREFIX',
  'GIT_COMMON_DIR',
]) {
  delete process.env[key];
}

const fixtures: string[] = [];
function fixture(): string {
  const dir = mkdtempSync(join(tmpdir(), 'cip-changes-test-'));
  fixtures.push(dir);
  execFileSync('git', ['init', '--quiet', dir], { env: fixtureEnv() });
  writeFileSync(join(dir, '.gitignore'), 'node_modules/\n');
  return dir;
}
function save(root: string, file: string, text: string): void {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), text);
}
function commit(root: string): void {
  execFileSync('git', ['add', '.'], { cwd: root, env: fixtureEnv() });
  execFileSync(
    'git',
    [
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.invalid',
      'commit',
      '--quiet',
      '-m',
      'fixture',
    ],
    { cwd: root, env: fixtureEnv() },
  );
}
afterEach(() => {
  vi.unstubAllEnvs();
  for (const dir of fixtures.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

describe('变更上下文：暂存内容、未暂存、新文件、删除与依赖', () => {
  it('开发合并所有变化，暂存模式只看实际 index，包括换行路径', () => {
    const root = fixture();
    save(root, 'old.ts', 'const a = 1;');
    commit(root);
    save(root, 'old.ts', 'const a = 2;');
    execFileSync('git', ['add', 'old.ts'], { cwd: root, env: fixtureEnv() });
    save(root, 'old.ts', 'const a = 3;');
    save(root, 'new\nfile.ts', 'const b = 1;');
    expect(collectChanges(root, 'worktree').files).toEqual([
      'new\nfile.ts',
      'old.ts',
    ]);
    expect(collectChanges(root, 'staged').files).toEqual(['old.ts']);
    const snapshot = materializeIndex(root);
    fixtures.push(snapshot);
    expect(readFileSync(join(snapshot, 'old.ts'), 'utf8')).toBe('const a = 2;');
    expect(existsSync(join(snapshot, 'new\nfile.ts'))).toBe(false);
    expect(readBefore(root, 'HEAD', 'old.ts')).toBe('const a = 1;');
  });
  it('删除/重命名两侧被保留，找不到 CI 基准必须失败', () => {
    const root = fixture();
    save(root, 'old.ts', 'const a = 1;');
    commit(root);
    execFileSync('git', ['mv', 'old.ts', 'renamed.ts'], {
      cwd: root,
      env: fixtureEnv(),
    });
    expect(collectChanges(root, 'staged').files).toEqual([
      'old.ts',
      'renamed.ts',
    ]);
    expect(() => collectChanges(root, 'ci', 'missing')).toThrow('检查基准');
  });
  it('摘要覆盖未修改消费方和检查配置，暂存摘要不受普通未暂存文件干扰', () => {
    const root = fixture();
    save(root, 'a.ts', 'const a = 1;');
    save(root, 'b.ts', 'const b = 1;');
    commit(root);
    const initial = fingerprint(root, 'worktree');
    const staged = fingerprint(root, 'staged');
    save(root, 'b.ts', 'const b = 2;');
    expect(fingerprint(root, 'worktree')).not.toBe(initial);
    expect(fingerprint(root, 'staged')).toBe(staged);
    execFileSync('git', ['add', 'b.ts'], { cwd: root, env: fixtureEnv() });
    expect(fingerprint(root, 'staged')).not.toBe(staged);
  });
  it('拒绝绝对路径、父目录和逃逸符号链接', () => {
    const root = fixture();
    expect(() => safePath(root, '../outside')).toThrow('越出仓库');
    expect(() => safePath(root, '/etc/passwd')).toThrow('越出仓库');
    symlinkSync(tmpdir(), join(root, 'escape'), 'dir');
    expect(() => safePath(root, 'escape')).toThrow('越出仓库');
  });
  it('shared 和未知配置扩大验证，纯 API 变更仍跑包级测试', () => {
    const shared = createPlan(['packages/shared/src/index.ts'], false);
    expect(shared.packages).toEqual(['api', 'shared', 'web']);
    expect(shared.commands.some((c) => c.args.includes('codegen'))).toBe(true);
    expect(createPlan(['new-config.json'], false).packages).toEqual([
      'api',
      'shared',
      'web',
    ]);
    const api = createPlan(
      ['apps/api/src/modules/iam/application/user.service.ts'],
      false,
    );
    expect(api.commands.some((c) => c.args.includes('test:unit'))).toBe(true);
    expect(
      createPlan(['apps/web/features/a.tsx'], true).commands.some((c) =>
        c.args.includes('test'),
      ),
    ).toBe(false);
  });
  it('参数错误不能被当成快速成功；监听只允许开发模式', () => {
    expect(parseOptions(['--mode', 'staged', '--quick']).mode).toBe('staged');
    expect(() => parseOptions(['--quik'])).toThrow('未知参数');
    expect(() => parseOptions(['--mode', 'ci', '--watch'])).toThrow(
      '仅允许开发',
    );
    expect(() => parseOptions(['--base'])).toThrow('缺少基准');
  });
});

describe('反馈完整性：监听、暂存与检查期间改动', () => {
  it('连续保存合并，未变内容不重复跑，过期结果必须重新检查', () => {
    const queue = new SaveCheckQueue();
    expect(queue.shouldRun('a', 0)).toBe(false);
    expect(queue.shouldRun('a', 900)).toBe(false);
    expect(queue.shouldRun('b', 1000)).toBe(false);
    expect(queue.shouldRun('b', 2000)).toBe(true);
    queue.complete('b', false);
    expect(queue.shouldRun('b', 3000)).toBe(false);
    queue.complete('b', true);
    expect(queue.shouldRun('b', 3500)).toBe(true);
  });
  it('命令执行期间源码改变时，即使命令返回零也不能报告通过', () => {
    const root = fixture();
    save(root, 'apps/web/data.json', '{}\n');
    const binary = join(root, 'bin/pnpm');
    save(
      root,
      'bin/pnpm',
      `#!${process.execPath}\nrequire('node:fs').writeFileSync('apps/web/data.json', '{"changed":true}');\n`,
    );
    chmodSync(binary, 0o755);
    commit(root);
    save(root, 'apps/web/data.json', '{"initial":true}\n');
    vi.stubEnv('PATH', `${join(root, 'bin')}:${process.env.PATH}`);
    const report = runChanged(root, parseOptions(['--quick']));
    expect(report.commands.every((c) => c.status === 0)).toBe(true);
    expect(report.status).toBe('stale');
  });
  it('暂存模式的子命令也读取 index 内容，不读取未暂存的版本', () => {
    const root = fixture();
    save(root, 'apps/web/data.json', '{"value":1}\n');
    const observed = join(root, 'observed.txt');
    save(
      root,
      'bin/pnpm',
      `#!${process.execPath}\nconst fs=require('node:fs');fs.writeFileSync(${JSON.stringify(observed)},fs.readFileSync('apps/web/data.json'));\n`,
    );
    chmodSync(join(root, 'bin/pnpm'), 0o755);
    commit(root);
    save(root, 'apps/web/data.json', '{"value":2}\n');
    execFileSync('git', ['add', 'apps/web/data.json'], {
      cwd: root,
      env: fixtureEnv(),
    });
    save(root, 'apps/web/data.json', '{"value":3}\n');
    vi.stubEnv('PATH', `${join(root, 'bin')}:${process.env.PATH}`);
    const report = runChanged(
      root,
      parseOptions(['--mode', 'staged', '--quick']),
    );
    expect(report.status).toBe('passed');
    expect(JSON.parse(readFileSync(observed, 'utf8'))).toEqual({ value: 2 });
    expect(
      JSON.parse(readFileSync(join(root, 'apps/web/data.json'), 'utf8')),
    ).toEqual({ value: 3 });
  });
  it('只有真实 DDL 才要求迁移，不接受缺失迁移的结构变更', () => {
    expect(
      checkMigrationRequired('-- This is an empty migration.\n', []),
    ).toEqual([]);
    expect(
      checkMigrationRequired('CREATE TABLE t (id TEXT);', [
        'new/migration.sql',
      ]),
    ).toEqual([]);
    expect(
      checkMigrationRequired('CREATE TABLE t (id TEXT);', [])[0]?.rule,
    ).toBe('DB-7.1');
  });
  it('多行外键删除声明仍能判断，不因换行漏报', () => {
    const multiline = legalModel.replace(
      '@relation(fields: [ownerId], references: [id], onDelete: Restrict)',
      '@relation(\n fields: [ownerId],\n references: [id]\n)',
    );
    expect(checkDatabase(multiline, '', contexts).map((d) => d.rule)).toContain(
      'DB-5.1',
    );
  });
  it('组合 schema 内部引用变化不能因 ref 字符串相同而漏报', () => {
    const composed = (type: string) => ({
      ...document({ oneOf: [{ $ref: '#/components/schemas/Value' }] }),
      components: { schemas: { Value: { type } } },
    });
    expect(
      compareContracts(composed('string'), composed('number')).length,
    ).toBeGreaterThan(0);
  });
});

describe('隔离环境：数据库文本与 pnpm 运行目录', () => {
  it('JSON 默认值和注释中的花括号不截断模型', () => {
    const json = legalModel.replace(
      '@@map',
      'options Json @default("{}")\n @@map',
    );
    expect(
      checkDatabase(json, '', contexts).filter((d) => d.kind === 'violation'),
    ).toEqual([]);
    expect(() =>
      checkDatabase('model Broken { id String', '', contexts),
    ).toThrow('无法解析');
  });
  it('安装依赖可复用，pnpm 任务状态目录必须在快照独立创建', () => {
    const root = fixture();
    const snapshot = fixture();
    save(root, 'node_modules/example/package.json', '{}');
    save(root, 'node_modules/.pnpm-task-run-state-v1/state', 'private');
    attachDependencies(root, snapshot);
    expect(lstatSync(join(snapshot, 'node_modules')).isSymbolicLink()).toBe(
      false,
    );
    expect(
      lstatSync(join(snapshot, 'node_modules/example')).isSymbolicLink(),
    ).toBe(true);
    expect(
      existsSync(join(snapshot, 'node_modules/.pnpm-task-run-state-v1')),
    ).toBe(false);
  });
});

describe('CI 基准与提交边界', () => {
  it('使用指定基准比较完整提交，拒绝生成后的纳管文件偏移', () => {
    const root = fixture();
    save(root, 'apps/web/item.json', '{}\n');
    commit(root);
    const base = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim();
    save(root, 'apps/web/item.json', '{"next":true}\n');
    commit(root);
    expect(collectChanges(root, 'ci', base).files).toEqual([
      'apps/web/item.json',
    ]);
    save(root, 'untracked.ts', 'const x = 1;');
    expect(() => collectChanges(root, 'ci', base)).toThrow('干净提交');
  });
});
