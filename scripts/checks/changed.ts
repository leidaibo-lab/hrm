import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkCode, isBusinessSource } from './code-quality.js';
import { compareBaseContract } from './contracts.js';
import {
  checkDatabase,
  checkMigration,
  checkMigrationRequired,
} from './database.js';
import {
  type CheckMode,
  collectChanges,
  fingerprint,
  materializeIndex,
  readBefore,
  safePath,
} from './lib/changes.js';
import { parseContextRegistry } from './lib/contexts.js';
import { type Diagnostic, formatDiagnostic } from './lib/diagnostics.js';
import { type CheckCommand, createPlan, SaveCheckQueue } from './lib/plan.js';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** 登记表来自仓库治理文档；测试夹具根缺少 docs 时回退到真实仓库。 */
function loadContexts(root: string) {
  const local = join(root, 'docs/conventions/database.md');
  const path = existsSync(local)
    ? local
    : join(REPO_ROOT, 'docs/conventions/database.md');
  return parseContextRegistry(readFileSync(path, 'utf8'));
}

/** CLI 选项显式区分快速反馈、批次验证和暂存/CI 上下文。 */
export interface CheckOptions {
  mode: CheckMode;
  base?: string;
  quick: boolean;
  plan: boolean;
  watch: boolean;
}

/** 命令拼写错误必须失败，不能静默切换范围。 */
export function parseOptions(args: string[]): CheckOptions {
  const result: CheckOptions = {
    mode: 'worktree',
    quick: false,
    plan: false,
    watch: false,
  };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--') continue;
    if (arg === '--quick') result.quick = true;
    else if (arg === '--plan') result.plan = true;
    else if (arg === '--watch') {
      result.watch = true;
      result.quick = true;
    } else if (arg === '--mode') {
      const mode = args[++index];
      if (mode !== 'worktree' && mode !== 'staged' && mode !== 'ci')
        throw new Error('--mode 必须是 worktree/staged/ci');
      result.mode = mode;
    } else if (arg === '--base') {
      result.base = args[++index];
      if (!result.base || result.base.startsWith('--'))
        throw new Error('--base 缺少基准');
    } else throw new Error(`未知参数：${arg}`);
  }
  if (result.watch && result.mode !== 'worktree')
    throw new Error('--watch 仅允许开发工作区模式');
  return result;
}

/** 单次真实命令结果；不记录环境变量或源码。 */
export interface CommandResult {
  label: string;
  command: string[];
  status: number | null;
  error?: string;
}

/** 输出只声明机器结果，人工和外部环境要求必须另行验收。 */
export interface CheckReport {
  mode: CheckMode;
  base: string | null;
  digest: string;
  status: 'passed' | 'violations' | 'execution_error' | 'stale' | 'planned';
  files: string[];
  diagnostics: Diagnostic[];
  commands: CommandResult[];
  manual: string[];
  unverified: string[];
}

/** 执行一个逻辑批次的检查；保留原门禁，不进行自动修复。 */
export function runChanged(root: string, options: CheckOptions): CheckReport {
  const changes = collectChanges(root, options.mode, options.base);
  const digest = fingerprint(root, options.mode);
  const plan = createPlan(changes.files, options.quick);
  const report: CheckReport = {
    mode: options.mode,
    base: changes.base,
    digest,
    status: options.plan ? 'planned' : 'passed',
    files: changes.files,
    diagnostics: [],
    commands: [],
    manual: plan.manual,
    unverified: [],
  };
  if (options.plan) {
    console.log(JSON.stringify({ ...report, plan }, null, 2));
    return report;
  }
  let snapshot: string | undefined;
  try {
    if (options.mode === 'staged') snapshot = materializeIndex(root);
    const cwd = snapshot ?? root;
    const textOf = (file: string) => {
      const path = safePath(cwd, file);
      return existsSync(path) ? readFileSync(path, 'utf8') : null;
    };
    for (const file of changes.files) {
      if (isBusinessSource(file)) {
        const text = textOf(file);
        if (text !== null) report.diagnostics.push(...checkCode(file, text));
      }
      if (/^apps\/api\/prisma\/migrations\/[^/]+\/migration\.sql$/.test(file))
        report.diagnostics.push(
          ...checkMigration(
            file,
            textOf(file),
            readBefore(root, changes.base, file),
          ),
        );
    }
    if (plan.database) {
      const schemaFile = 'apps/api/prisma/schema.prisma';
      const text = textOf(schemaFile);
      if (text === null) throw new Error('数据库 schema 被移除，无法继续验证');
      report.diagnostics.push(
        ...checkDatabase(
          text,
          readBefore(root, changes.base, schemaFile) ?? '',
          loadContexts(root),
        ),
      );
      report.unverified.push(
        '数据库实际约束、删除、事务、并发、空库重放和已有数据升级必须在隔离数据库另行验证',
      );
    }
    function execute(command: CheckCommand): void {
      const args =
        command.args[0] === 'exec' && command.args[1] === 'biome'
          ? [
              ...command.args.slice(0, command.args.indexOf('--') + 1),
              ...command.args
                .slice(command.args.indexOf('--') + 1)
                .filter((p) => existsSync(safePath(cwd, p))),
            ]
          : command.args;
      if (args.at(-1) === '--') return;
      console.log(`check:changed → pnpm ${args.join(' ')}`);
      const env = { ...process.env };
      // Offline generation needs only a placeholder; never initialize services.
      env.DATABASE_URL = 'postgresql://unused:unused@127.0.0.1:1/unused';
      env.OPENAPI_INPUT = '../api/node_modules/.tmp/openapi.json';
      const done = spawnSync('pnpm', args, { cwd, env, stdio: 'inherit' });
      report.commands.push({
        label: command.label,
        command: ['pnpm', ...args],
        status: done.status,
        ...(done.error ? { error: done.error.message } : {}),
      });
      if (done.error || done.signal) report.status = 'execution_error';
      else if (done.status !== 0 && report.status !== 'execution_error')
        report.status = 'violations';
    }
    if (
      plan.database &&
      changes.files.includes('apps/api/prisma/schema.prisma')
    ) {
      const temp = mkdtempSync(join(tmpdir(), 'cip-schema-'));
      try {
        const before = join(temp, 'before.prisma');
        writeFileSync(
          before,
          readBefore(root, changes.base, 'apps/api/prisma/schema.prisma') ??
            'datasource db {\n provider = "postgresql"\n}\n',
        );
        const args = [
          '--filter',
          '@cip/api',
          'exec',
          'prisma',
          'migrate',
          'diff',
          '--from-schema',
          before,
          '--to-schema',
          'prisma/schema.prisma',
          '--script',
        ];
        const ddl = execFileSync('pnpm', args, {
          cwd,
          encoding: 'utf8',
          env: {
            ...process.env,
            DATABASE_URL: 'postgresql://unused:unused@127.0.0.1:1/unused',
          },
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        report.commands.push({
          label: '离线数据库结构差异',
          command: ['pnpm', ...args],
          status: 0,
        });
        const newMigrations = changes.files.filter(
          (file) =>
            /\/migrations\/[^/]+\/migration\.sql$/.test(file) &&
            readBefore(root, changes.base, file) === null,
        );
        report.diagnostics.push(...checkMigrationRequired(ddl, newMigrations));
      } finally {
        rmSync(temp, { recursive: true, force: true });
      }
    }
    if (plan.database)
      execute({
        label: 'Prisma schema',
        args: ['--filter', '@cip/api', 'exec', 'prisma', 'validate'],
      });
    for (const command of plan.commands) execute(command);
    if (plan.contracts) {
      if (options.quick)
        report.unverified.push(
          '快速模式未执行 OpenAPI 基准兼容比较；逻辑批次必须运行完整模式',
        );
      else if (!changes.base)
        report.unverified.push('首次建库无旧提交契约，必须人工确认初始 API');
      else {
        const output = join(cwd, 'apps/api/node_modules/.tmp/openapi.json');
        const exported = report.commands.find(
          (c) => c.label === '离线 OpenAPI 导出',
        );
        if (exported?.status === 0)
          report.diagnostics.push(
            ...compareBaseContract(root, changes.base, output),
          );
        else report.unverified.push('OpenAPI 导出失败，未执行契约兼容比较');
      }
    }
    if (
      plan.manual.some((item) => item.includes('隔离数据库')) &&
      !plan.database
    )
      report.unverified.push(
        '本入口未运行隔离数据库行为测试，事务/并发与数据升级证据需另行取得',
      );
    if (options.quick && changes.files.length)
      report.unverified.push(
        '快速模式未运行包级类型与行为测试，批次收口必须运行完整模式',
      );
    if (report.diagnostics.some((d) => d.kind === 'error'))
      report.status = 'execution_error';
    else if (
      report.diagnostics.some((d) => d.kind === 'violation') &&
      report.status === 'passed'
    )
      report.status = 'violations';
  } catch (cause) {
    report.status = 'execution_error';
    report.diagnostics.push({
      rule: 'CHECK-EXECUTION',
      file: 'scripts/checks/changed.ts',
      line: 1,
      kind: 'error',
      message: cause instanceof Error ? cause.message : '未知执行错误',
    });
  } finally {
    if (snapshot) rmSync(snapshot, { recursive: true, force: true });
  }
  if (fingerprint(root, options.mode) !== digest) report.status = 'stale';
  for (const diagnostic of report.diagnostics)
    console.log(formatDiagnostic(diagnostic));
  for (const item of report.manual) console.log(`人工待确认：${item}`);
  for (const item of report.unverified) console.log(`未验证：${item}`);
  const output = join(
    root,
    'node_modules/.tmp/quality',
    `changed-${options.mode}.json`,
  );
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    `check:changed ${report.status}; ${changes.files.length} files; digest ${digest.slice(0, 12)}`,
  );
  return report;
}

/** 轮询摘要并合并连续保存；同一进程不并行检查，也不复用旧成功结果。 */
async function watch(root: string, options: CheckOptions): Promise<void> {
  const queue = new SaveCheckQueue();
  let running = true;
  const stop = () => {
    running = false;
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  console.log('check:changed watch：保存稳定 1 秒后快速检查；Ctrl+C 退出');
  try {
    while (running) {
      const now = fingerprint(root, options.mode);
      if (queue.shouldRun(now, Date.now())) {
        const report = runChanged(root, options);
        queue.complete(report.digest, report.status === 'stale');
      }
      await new Promise((done) => setTimeout(done, 500));
    }
  } finally {
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  try {
    const options = parseOptions(process.argv.slice(2));
    if (options.watch) await watch(root, options);
    else {
      const report = runChanged(root, options);
      if (report.status !== 'passed' && report.status !== 'planned')
        process.exitCode = 1;
    }
  } catch (cause) {
    console.error(cause instanceof Error ? cause.message : '变更检查执行失败');
    process.exitCode = 1;
  }
}
