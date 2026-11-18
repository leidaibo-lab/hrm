import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

/** 三种检查上下文；暂存和 CI 都有明确的比较基准。 */
export type CheckMode = 'worktree' | 'staged' | 'ci';

/** 变更集合包含删除和重命名两侧；before 读取目标基准。 */
export interface ChangeSet {
  mode: CheckMode;
  base: string | null;
  files: string[];
}

/** Git 参数通过数组传递，路径包含空格或换行不会被 shell 解释。 */
export function git(root: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
}

function nul(text: string): string[] {
  return text.split('\0').filter(Boolean);
}

/** 校验路径在仓库内且不经符号链接逃逸；不存在的删除路径仍可检查。 */
export function safePath(root: string, file: string): string {
  const full = resolve(root, file);
  if (
    isAbsolute(file) ||
    full === root ||
    !full.startsWith(`${resolve(root)}${sep}`)
  )
    throw new Error('检查路径越出仓库');
  if (existsSync(full)) {
    const actual = realpathSync(full);
    if (!actual.startsWith(`${realpathSync(root)}${sep}`))
      throw new Error(`符号链接越出仓库：${file}`);
  }
  return full;
}

/** 开发合并所有未提交变更；CI 缺少有效基准时失败而非退回 HEAD。 */
export function collectChanges(
  root: string,
  mode: CheckMode,
  requestedBase?: string,
): ChangeSet {
  let base: string | null = null;
  const candidate =
    requestedBase ??
    (mode === 'ci'
      ? process.env.CI_MERGE_REQUEST_DIFF_BASE_SHA ||
        process.env.CI_COMMIT_BEFORE_SHA
      : 'HEAD');
  if (candidate && !/^0+$/.test(candidate)) {
    try {
      base = git(root, [
        'rev-parse',
        '--verify',
        '--end-of-options',
        `${candidate}^{commit}`,
      ]).trim();
    } catch {
      if (mode === 'ci' || requestedBase)
        throw new Error('无法解析检查基准；CI 必须提供可用的目标基准');
    }
  }
  if (mode === 'ci' && !base)
    throw new Error('CI 缺少目标基准；请传 --base 或配置合并请求基准');
  if (mode === 'ci' && base)
    base = git(root, ['merge-base', 'HEAD', base]).trim();
  if (
    mode === 'ci' &&
    git(root, ['status', '--porcelain', '-z', '--untracked-files=normal'])
  )
    throw new Error('CI 必须检查干净提交，工作区存在未提交或新文件');
  const files = new Set<string>();
  if (base) {
    const args = ['diff', '--name-only', '--no-renames', '-z'];
    if (mode === 'staged') args.push('--cached');
    args.push(base, '--');
    for (const file of nul(git(root, args))) files.add(file);
  } else {
    for (const file of nul(git(root, ['ls-files', '-z']))) files.add(file);
  }
  if (mode === 'worktree') {
    for (const file of nul(
      git(root, ['ls-files', '--others', '--exclude-standard', '-z']),
    ))
      files.add(file);
  }
  return { mode, base, files: [...files].sort() };
}

/** 读取比较基准；不存在才返回 null，其他 Git 错误必须传播。 */
export function readBefore(
  root: string,
  base: string | null,
  file: string,
): string | null {
  if (!base) return null;
  const present = git(root, ['ls-tree', '-z', base, '--', file]);
  if (!present) return null;
  return git(root, ['show', `${base}:${file}`]);
}

/** 摘要覆盖全部纳管/新文件与 HEAD，防止检查期间依赖文件变化。 */
export function fingerprint(root: string, mode: CheckMode): string {
  const hash = createHash('sha256');
  hash.update(mode);
  if (mode === 'staged') {
    hash.update(git(root, ['ls-files', '--stage', '-z']));
    for (const file of nul(
      git(root, [
        'ls-files',
        '--cached',
        '--others',
        '--exclude-standard',
        '-z',
      ]),
    ).filter((p) => p.startsWith('scripts/checks/'))) {
      const full = safePath(root, file);
      if (existsSync(full)) hash.update(readFileSync(full));
    }
  } else {
    const files = [
      ...new Set(
        nul(
          git(root, [
            'ls-files',
            '--cached',
            '--others',
            '--exclude-standard',
            '-z',
          ]),
        ),
      ),
    ].sort();
    for (const file of files) {
      const full = safePath(root, file);
      hash.update(`${file}\0`);
      hash.update(
        existsSync(full) && !lstatSync(full).isDirectory()
          ? readFileSync(full)
          : '<deleted>',
      );
    }
    hash.update(git(root, ['ls-files', '--stage', '-z']));
  }
  try {
    hash.update(git(root, ['rev-parse', 'HEAD']));
  } catch {
    hash.update('<unborn>');
  }
  return hash.digest('hex');
}

/** 暂存内容写入隔离目录；复用安装依赖，不覆盖或暂存用户工作文件。 */
export function materializeIndex(root: string): string {
  const snapshot = mkdtempSync(join(tmpdir(), 'cip-index-'));
  git(root, ['checkout-index', '--all', '--force', `--prefix=${snapshot}/`]);
  git(snapshot, ['init', '--quiet']);
  git(snapshot, ['add', '--all', '--force']);
  attachDependencies(root, snapshot);
  return snapshot;
}

/** 只挂载安装依赖及忽略的生成产物；不复制 .env 或凭据。 */
export function attachDependencies(root: string, snapshot: string): void {
  for (const dir of [
    'node_modules',
    'apps/api/node_modules',
    'apps/web/node_modules',
    'packages/shared/node_modules',
  ]) {
    const target = join(root, dir);
    const destination = join(snapshot, dir);
    if (!existsSync(target) || !existsSync(dirname(destination))) continue;
    mkdirSync(destination, { recursive: true });
    for (const entry of readdirSync(target)) {
      if (['.tmp', '.cache'].includes(entry) || entry.startsWith('.pnpm-task'))
        continue;
      const link = join(destination, entry);
      if (!existsSync(link)) symlinkSync(join(target, entry), link);
    }
  }

  for (const dir of [
    'apps/api/src/platform/prisma/generated',
    'apps/web/lib/api-client',
  ]) {
    if (existsSync(join(root, dir)) && !existsSync(join(snapshot, dir)))
      cpSync(join(root, dir), join(snapshot, dir), { recursive: true });
  }
}

/** 相对路径用于稳定诊断，避免报告临时目录。 */
export function relativeFile(root: string, file: string): string {
  return relative(root, file).replaceAll('\\', '/');
}
