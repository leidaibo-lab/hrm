import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 代码注释机检：export 缺 JSDoc、注释以文档/规则/ADR 引用为主体、注释掉的代码、无归属 TODO。
 * 规则来源：代码注释规范（JSDoc）规则 1 / 10 / 11 / 13。
 * 豁免：vendor 目录、生成的 Prisma Client、由 schema 或常量直接推导的类型别名。
 */
const ROOT = resolve(process.cwd(), '../..');
const SOURCE_ROOTS = [
  'apps/api/src',
  'apps/web/app',
  'apps/web/components',
  'apps/web/features',
  'apps/web/hooks',
  'apps/web/lib',
  'packages/shared/src',
];
const SKIP_DIRS = [
  'node_modules',
  '.next',
  'dist',
  'generated',
  'ui',
  'ai-elements',
  'api-client',
];
const DERIVED_TYPE =
  /(z\.infer|typeof |Pick<|Omit<|Partial<|ReturnType<|Parameters<)/;
const ZOD_CONST = /=\s*(z|zod)\./;
const UPPER_SCALAR = /^[A-Z][A-Z0-9_]*$/;
const FRAMEWORK_EXPORTS = new Set([
  'dynamic',
  'revalidate',
  'metadata',
  'generateMetadata',
  'viewport',
  'runtime',
  'fetchCache',
  'preferredRegion',
  'maxDuration',
]);

/** 递归收集源码文件，跳过 vendor 与生成目录。 */
function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.includes(entry.name)) walk(join(dir, entry.name), acc);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      acc.push(join(dir, entry.name));
    }
  }
  return acc;
}

const SELF = 'code-comments.spec.ts';
/** 引用样例注册文件：其字符串字面量内嵌违规样例，仅豁免引用主体检查（AST 级判定在 code-quality.ts）。 */
const SAMPLE_REGISTRY = 'quality-gates.spec.ts';
const FILES = SOURCE_ROOTS.flatMap((dir) => walk(join(ROOT, dir))).filter(
  (file) => !file.endsWith(SELF),
);

/** 取文件行数组。 */
const linesOf = (file: string): string[] =>
  readFileSync(file, 'utf8').split('\n');

describe('代码注释：export 必须有 JSDoc', () => {
  it('所有 export 声明上方存在 /** */ 块注释或属于豁免类别', () => {
    const violations: string[] = [];
    for (const file of FILES) {
      const lines = linesOf(file);
      const rel = relative(ROOT, file);
      lines.forEach((line, index) => {
        const match = line.match(
          /^export\s+(?:async\s+)?(?:function|class|interface|type|const|let|enum)\s+([A-Za-z_$][\w$]*)/,
        );
        if (!match) return;
        const name = match[1];
        if (FRAMEWORK_EXPORTS.has(name)) return;
        if (/^export class \w+Module\b/.test(line)) return;
        if (line.includes('export type ') && DERIVED_TYPE.test(line)) return;
        if (line.includes('export const ') && ZOD_CONST.test(line)) return;
        if (UPPER_SCALAR.test(name) && /=\s*['"\d]/.test(line)) return;
        let hasDoc = false;
        for (let back = index - 1; back >= 0 && back >= index - 12; back -= 1) {
          const probe = lines[back].trim();
          if (probe === '') continue;
          if (probe.endsWith('*/')) {
            hasDoc = true;
            break;
          }
          if (probe.startsWith('@')) continue;
          break;
        }
        if (!hasDoc) violations.push(`${rel}:${index + 1} ${name}`);
      });
    }
    expect(violations).toEqual([]);
  });
});

describe('代码注释：内容规则', () => {
  it('注释不得以文档路径/规则编号/ADR 编号为主体（引用只能括注并列在契约说明后）', () => {
    // 引用形态：docs 路径、规范文档文件名、ADR 编号、规则 ID（CMT-4.4）。
    // 本检查为正则粗筛（无法区分字符串与注释，样例注册文件已豁免）；
    // AST 级精确判定在 scripts/checks/code-quality.ts，经 check:changed 增量执行。
    const REFERENCE_PATTERN = new RegExp(
      [
        'docs\\/(?:conventions|process|reference|decisions|prd)',
        '\\b(?:architecture|contracts|persistence|authorization|database|naming|documentation|frontend|web-ui-components|web-ui|forms|testing|code-comments|code-quality|security|runtime|boundaries|workflow|verification|governance)\\.md\\b',
        '\\bADR-\\d{4}\\b',
        '\\b(?:ARC|CON|PER|AUT|NAM|WEB|UI|UIC|FRM|TST|CMT|QLT|DB|DOC|BND)-\\d+\\.\\d+\\b',
      ].join('|'),
      'g',
    );
    const violations: string[] = [];
    for (const file of FILES) {
      if (file.endsWith(SAMPLE_REGISTRY)) continue;
      const text = readFileSync(file, 'utf8');
      const rel = relative(ROOT, file);
      for (const block of text.matchAll(/\/\*[\s\S]*?\*\//g)) {
        REFERENCE_PATTERN.lastIndex = 0;
        if (!REFERENCE_PATTERN.test(block[0])) continue;
        const remainder = block[0].replaceAll(REFERENCE_PATTERN, '');
        // 主体判定：移除全部引用后正文 CJK 少于 4 字＝引用代替契约说明；
        // 「契约说明 + 括注编号」的并列形式合规，语义厚度由 review 承接。
        const cjkCount = remainder.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
        if (cjkCount < 4) {
          const line = text.slice(0, block.index).split('\n').length;
          violations.push(`${rel}:${line}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('不得保留注释掉的代码', () => {
    const pattern =
      /^\s*\/\/\s*(const |let |return |await |import |export |function |if \(|for \(|console\.|throw new )/;
    const violations: string[] = [];
    for (const file of FILES) {
      linesOf(file).forEach((line, index) => {
        if (pattern.test(line))
          violations.push(`${relative(ROOT, file)}:${index + 1}`);
      });
    }
    expect(violations).toEqual([]);
  });

  it('TODO 必须带负责人或 issue 编号', () => {
    const violations: string[] = [];
    for (const file of FILES) {
      linesOf(file).forEach((line, index) => {
        if (!/^\s*(\/\/|\*|\/\*)/.test(line)) return;
        if (!/TODO/.test(line)) return;
        if (/TODO[^\n]*(#\d+|issue|负责人)/.test(line)) return;
        violations.push(`${relative(ROOT, file)}:${index + 1}`);
      });
    }
    expect(violations).toEqual([]);
  });
});
