import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { checkDocs } from '../../../../scripts/checks/docs.js';

const ROOT = resolve(process.cwd(), '../..');
let fixture: string;
const originals = new Map<string, string | null>();
function change(path: string, content: string): void {
  const file = join(fixture, path);
  if (!originals.has(file))
    originals.set(file, existsSync(file) ? readFileSync(file, 'utf8') : null);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}
function replace(path: string, from: string, to: string): void {
  const source = readFileSync(join(fixture, path), 'utf8');
  if (!source.includes(from))
    throw new Error(`失效的测试样例：${path} 缺少 ${from}`);
  change(path, source.replaceAll(from, to));
}
function errors(): string {
  return checkDocs(fixture).errors.join('\n');
}

beforeAll(() => {
  fixture = mkdtempSync(join(tmpdir(), 'cip-docs-'));
  for (const path of [
    'AGENTS.md',
    'README.md',
    'CLAUDE.md',
    'package.json',
    'docs',
    'apps',
    'packages',
  ]) {
    if (!existsSync(join(ROOT, path))) continue;
    cpSync(join(ROOT, path), join(fixture, path), {
      recursive: true,
      filter: (source) =>
        ![
          'node_modules',
          '.next',
          'dist',
          'generated',
          'api-client',
          '.env',
          '.git',
        ].includes(basename(source)),
    });
  }
  execFileSync('git', ['init', '--quiet', fixture]);
});
afterEach(() => {
  for (const [file, content] of originals) {
    if (content === null) rmSync(file, { force: true });
    else writeFileSync(file, content);
  }
  originals.clear();
});
afterAll(() => {
  rmSync(fixture, { recursive: true, force: true });
});

describe('文档检查唯一实现：真实源码和合法样例', () => {
  it('真实仓库满足完整检查', () => {
    expect(checkDocs(ROOT).errors).toEqual([]);
  });
  it('干净副本不需要本地密钥或构建产物', () => {
    expect(checkDocs(fixture).errors).toEqual([]);
  });
  it('重排 ADR 的正文不会改变编号或状态语义', () => {
    const path = 'docs/decisions/0001-doc-structure-governance.md';
    change(path, `${readFileSync(join(fixture, path), 'utf8')}\n附加说明。\n`);
    expect(checkDocs(fixture).errors).toEqual([]);
  });
});

describe('文档检查回归：违规必须拒绝', () => {
  it('拒绝超出篇数预算和未登记的新文档', () => {
    change(
      'docs/conventions/unregistered.md',
      '# 示例\n\n> 层：规范 · 时态：约束未来 · 失效：规则变化时\n',
    );
    expect(errors()).toContain('现行文档篇数不得超过');
    expect(errors()).toContain(
      'index.md 未列出 docs/conventions/unregistered.md',
    );
  });
  it('拒绝缺失的现行清单引用', () => {
    replace(
      'docs/index.md',
      '`docs/conventions/forms.md`',
      '`docs/conventions/testing.md`',
    );
    expect(errors()).toContain('index.md 未列出 docs/conventions/forms.md');
  });
  it('拒绝无效三元组和超长文档', () => {
    replace('docs/conventions/forms.md', '> 层：规范', '> 层：未知');
    change(
      'docs/conventions/forms.md',
      readFileSync(join(fixture, 'docs/conventions/forms.md'), 'utf8') +
        '\n'.repeat(121),
    );
    expect(errors()).toContain('三元组不合法');
    expect(errors()).toContain('超过上限');
  });
  it('拒绝根目录游离文档和失效文档/代码引用', () => {
    change('orphan.md', '# 游离');
    change(
      'docs/conventions/forms.md',
      `${readFileSync(join(fixture, 'docs/conventions/forms.md'), 'utf8')}\n引用：\`missing-doc.md\`、\`apps/web/missing.ts\`。\n`,
    );
    expect(errors()).toContain('根目录存在未纳管文档 orphan.md');
    expect(errors()).toContain('引用不存在的文档 missing-doc.md');
    expect(errors()).toContain('引用不存在的代码路径 apps/web/missing.ts');
  });
  it('拒绝不存在的命令和技术栈漂移', () => {
    replace(
      'docs/reference/verification.md',
      '`pnpm install`',
      '`pnpm missing-command`',
    );
    replace('docs/index.md', 'NestJS 12', 'NestJS 99');
    expect(errors()).toContain('脚本 missing-command 不存在');
    expect(errors()).toContain('版本 99 与实际');
  });
  it('拒绝 ADR 编号缺口和非法状态头', () => {
    change('docs/decisions/9999-invalid.md', '# 无效\n\n> 状态：未知\n');
    expect(errors()).toContain('ADR 编号不连续');
    expect(errors()).toContain('9999-invalid.md 第 3 行状态头不合规');
  });
  it('拒绝目录式 PRD 缺少 index.md', () => {
    mkdirSync(join(fixture, 'docs/prd/no-index'), { recursive: true });
    try {
      expect(errors()).toContain('prd 目录 no-index 缺少 index.md');
    } finally {
      rmSync(join(fixture, 'docs/prd/no-index'), {
        recursive: true,
        force: true,
      });
    }
  });
  it('拒绝目录式 PRD 未登记在 index.md', () => {
    const source = readFileSync(
      join(fixture, 'docs/prd/agentic/index.md'),
      'utf8',
    );
    mkdirSync(join(fixture, 'docs/prd/unlisted'), { recursive: true });
    writeFileSync(join(fixture, 'docs/prd/unlisted/index.md'), source);
    try {
      expect(errors()).toContain('index.md 未列出 docs/prd/unlisted/index.md');
    } finally {
      rmSync(join(fixture, 'docs/prd/unlisted'), {
        recursive: true,
        force: true,
      });
    }
  });
  it('拒绝未登记模板的 PRD 文件', () => {
    change('docs/prd/agentic/temp.md', '# 临时\n');
    expect(errors()).toContain('prd 文件未登记模板：agentic/temp.md');
  });
  it('拒绝 PRD 目录超过一层', () => {
    mkdirSync(join(fixture, 'docs/prd/agentic/nested'), { recursive: true });
    writeFileSync(
      join(fixture, 'docs/prd/agentic/nested/inner.md'),
      '# 深层\n',
    );
    try {
      expect(errors()).toContain('prd 目录只允许一层：agentic/nested');
    } finally {
      rmSync(join(fixture, 'docs/prd/agentic/nested'), {
        recursive: true,
        force: true,
      });
    }
  });
  it('拒绝横切测试文件缺失', () => {
    const path = join(fixture, 'apps/api/src/__tests__/routes.spec.ts');
    originals.set(path, readFileSync(path, 'utf8'));
    rmSync(path);
    expect(errors()).toContain('缺少横切 spec：routes.spec.ts');
  });
  it('拒绝已纳入 Git 的生成产物', () => {
    change('apps/web/lib/api-client/fake.ts', 'export {};');
    execFileSync('git', ['add', '-f', 'apps/web/lib/api-client/fake.ts'], {
      cwd: fixture,
    });
    try {
      expect(errors()).toContain(
        '生成产物已入库：apps/web/lib/api-client/fake.ts',
      );
    } finally {
      execFileSync(
        'git',
        ['rm', '--cached', '-f', 'apps/web/lib/api-client/fake.ts'],
        { cwd: fixture },
      );
    }
  });
});
