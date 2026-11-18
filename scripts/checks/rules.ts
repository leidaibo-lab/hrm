#!/usr/bin/env node
/**
 * rules 机检：规则 ID 双向绑定 + 前端/命名可机检项。
 * 规则来源：docs/governance.md「规则质量要求」；落点表：docs/reference/verification.md。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';
import { parseContextRegistry } from './lib/contexts.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const errors: string[] = [];

const PREFIX = {
  ARC: 'docs/conventions/architecture.md',
  CON: 'docs/conventions/contracts.md',
  PER: 'docs/conventions/persistence.md',
  QLT: 'docs/conventions/code-quality.md',
  DB: 'docs/conventions/database.md',
  AUT: 'docs/conventions/authorization.md',
  NAM: 'docs/conventions/naming.md',
  WEB: 'docs/conventions/frontend.md',
  UI: 'docs/conventions/web-ui.md',
  UIC: 'docs/conventions/web-ui-components.md',
  FRM: 'docs/conventions/forms.md',
  TST: 'docs/conventions/testing.md',
  CMT: 'docs/conventions/code-comments.md',
  DOC: 'docs/conventions/documentation.md',
  BND: 'docs/process/boundaries.md',
};
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8');

// 1) 稳定 ID：所属前缀、格式与唯一性；不绑定文档位置。
const found = new Map<string, { doc: string; line: number }>();
for (const [prefix, doc] of Object.entries(PREFIX)) {
  if (!existsSync(join(ROOT, doc))) {
    errors.push(`前缀 ${prefix} 指向的文档不存在：${doc}`);
    continue;
  }
  read(doc)
    .split('\n')
    .forEach((line, i) => {
      const hit = /\s`([A-Z]{2,4})-(\d+)\.(\d+)`\s*$/.exec(line);
      if (!hit) return;
      const id = `${hit[1]}-${hit[2]}.${hit[3]}`;
      const p = hit[1];
      if (
        p !== prefix &&
        !(doc === 'docs/conventions/database.md' && id === 'PER-4.1')
      ) {
        errors.push(`${doc}:${i + 1} ID 前缀 ${p} 与文档不符`);
        return;
      }
      if (found.has(id)) {
        errors.push(`ID 重复：${id}（${doc}）`);
        return;
      }
      found.set(id, { doc, line: i + 1 });
    });
}

// 1b) 上下文登记表：前缀只能登记给语义上下文，技术/产品名不得成为上下文或前缀。
const FORBIDDEN_CONTEXTS = new Set([
  'ai',
  'app',
  'sys',
  'platform',
  'biz',
  'lark',
  'feishu',
  'gitlab',
  'zentao',
]);
const FORBIDDEN_PREFIXES = new Set([
  ...Array.from(FORBIDDEN_CONTEXTS, (name) => `${name}_`),
  'ferry_',
  'relay_',
  'continuity_',
  'model_',
]);
const contextSeen = new Set<string>();
const prefixSeen = new Set<string>();
try {
  const contexts = parseContextRegistry(read('docs/conventions/database.md'));
  for (const rule of contexts) {
    const where = `database.md 上下文 ${rule.context}`;
    if (contextSeen.has(rule.context)) errors.push(`${where} 重复登记`);
    contextSeen.add(rule.context);
    if (FORBIDDEN_CONTEXTS.has(rule.context))
      errors.push(`${where} 使用了技术/产品名，必须改为业务语义上下文`);
    if (rule.prefix) {
      if (prefixSeen.has(rule.prefix))
        errors.push(`${where} 前缀重复：${rule.prefix}`);
      prefixSeen.add(rule.prefix);
      if (FORBIDDEN_PREFIXES.has(rule.prefix))
        errors.push(`${where} 禁止使用技术/产品名前缀：${rule.prefix}`);
      const expected = `${rule.context.replaceAll('-', '_')}_`;
      if (rule.prefix !== expected)
        errors.push(`${where} 前缀必须为 ${expected}，实际 ${rule.prefix}`);
    }
    if (!rule.reserved) {
      if (rule.module === '')
        errors.push(`${where} 已启用上下文必须登记归属模块`);
      else if (!existsSync(join(ROOT, rule.module)))
        errors.push(`${where} 模块路径不存在：${rule.module}`);
    }
  }
} catch (error) {
  errors.push(error instanceof Error ? error.message : String(error));
}

// 2) verification.md 映射表双向
const ENFORCEMENT = new Set(['spec', 'script', 'hook', 'gitignore', 'manual']);
const mapped = new Map();
const table = read('docs/reference/verification.md');
for (const [i, line] of table.split('\n').entries()) {
  if (
    !line.startsWith('|') ||
    /^\|\s*-+/.test(line) ||
    line.includes('规则 ID')
  )
    continue;
  const cells = line
    .split('|')
    .slice(1, -1)
    .map((c) => c.trim());
  const id = /^`?([A-Z]{2,4}-\d+\.\d+)`?$/.exec(cells[0] ?? '');
  if (!id) continue;
  const [enforcement, landing] = [cells[3] ?? '', cells[4] ?? ''];
  if (mapped.has(id[1])) errors.push(`映射重复：${id[1]}`);
  mapped.set(id[1], { line: i + 1, enforcement, landing });
  if (!ENFORCEMENT.has(enforcement))
    errors.push(
      `verification.md:${i + 1} ${id[1]} 的 enforcement 非法：${enforcement}`,
    );
  const patterns: Record<string, RegExp> = {
    spec: /\.spec\.ts/,
    script: /scripts\/checks\/|check:/,
    hook: /\.husky\//,
    gitignore: /gitignore/,
  };
  const need = patterns[enforcement];
  if (need && !need.test(landing))
    errors.push(
      `verification.md:${i + 1} ${id[1]} 的落点与 enforcement 不匹配：${landing}`,
    );
  if (enforcement === 'manual' && !/review|人工/.test(landing))
    errors.push(
      `verification.md:${i + 1} ${id[1]} 人工规则须写明 review 或人工`,
    );
}
for (const id of found.keys())
  if (!mapped.has(id)) errors.push(`规则 ${id} 未登记到 verification.md`);
for (const id of mapped.keys())
  if (!found.has(id))
    errors.push(`verification.md 登记的 ${id} 在正文中不存在`);

// 3) 前端可机检项
const WEB_DIRS = ['apps/web/features', 'apps/web/app', 'apps/web/components'];
const VENDOR = /(\/components\/(ui|ai-elements)\/)/;
const walk = (dir: string): string[] => {
  if (!existsSync(join(ROOT, dir))) return [];
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const p = `${dir}/${e.name}`;
    return e.isDirectory() ? walk(p) : [p];
  });
};
const webFiles = WEB_DIRS.flatMap(walk).filter(
  (p) => /\.tsx$/.test(p) && !VENDOR.test(p),
);
for (const p of webFiles) {
  const text = read(p);
  const lines = text.split('\n');
  if (lines.length > 400) errors.push(`${p} 超过 400 行（${lines.length}）`);
  for (const [i, line] of lines.entries()) {
    if (/className=.{101,}/.test(line))
      errors.push(`${p}:${i + 1} className 超过 100 列`);
    if (/\?\s*<[^?]*: null\}/.test(line))
      errors.push(`${p}:${i + 1} 禁止 JSX 条件渲染 cond ? <Node/> : null`);
  }
}
const featureFiles = walk('apps/web/features').filter((p) => /\.tsx$/.test(p));
for (const p of featureFiles) {
  const text = read(p);
  for (const [i, line] of text.split('\n').entries()) {
    if (/useState.*(fieldErrors|formError)/.test(line))
      errors.push(
        `${p}:${i + 1} 表单错误必须走 react-hook-form，不得进 useState`,
      );
    if (
      /<(Input|Textarea|Select|input|textarea|select)\b[^>]*defaultValue/.test(
        line,
      )
    )
      errors.push(`${p}:${i + 1} 表单不得用 defaultValue 回填`);
  }
}

// NAM-7.1: 工程脚本统一 TypeScript，不保留 JS 或独立类型声明副本。
for (const p of walk('scripts')) {
  if (/\.(mjs|cjs|js|d\.mts)$/.test(p))
    errors.push(`${p} 工程脚本必须使用 .ts`);
}

// NAM-6.1: 文件路径的可判定部分；组件/函数符号语义由 review 承接。
for (const p of webFiles) {
  const name = p.split('/').pop() ?? '';
  // 测试文件遵循 testing.md 命名（<被测对象>.spec.tsx，后缀段不参与 kebab 判定）。
  if (!/^[a-z][a-z0-9-]*(\.(?:spec|test))?\.tsx$/.test(name))
    errors.push(`${p} 文件名必须 kebab-case`);
}

// 3b) Biome 唯一：禁止 ESLint / Prettier 并行配置
const FORBIDDEN_CONFIGS = [
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.json',
  '.eslintignore',
  'eslint.config.js',
  'eslint.config.mjs',
  'eslint.config.cjs',
  '.prettierrc',
  '.prettierrc.js',
  '.prettierrc.json',
  '.prettierrc.cjs',
  'prettier.config.js',
  'prettier.config.mjs',
  '.prettierignore',
];
for (const file of FORBIDDEN_CONFIGS) {
  if (existsSync(join(ROOT, file)))
    errors.push(`禁止 ESLint/Prettier 并行配置：${file}`);
}
const rootPkg = JSON.parse(read('package.json'));
for (const dep of ['eslint', 'prettier']) {
  if (rootPkg.devDependencies?.[dep] || rootPkg.dependencies?.[dep])
    errors.push(`根 package.json 不得引入 ${dep}`);
}

// NAM-5.2: 标识符禁止 Ref 后缀（AST 声明位扫描，避免误伤 useRef / refresh）
const REF_DECLARATION_KINDS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.VariableDeclaration,
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.ClassDeclaration,
  ts.SyntaxKind.InterfaceDeclaration,
  ts.SyntaxKind.TypeAliasDeclaration,
  ts.SyntaxKind.EnumDeclaration,
  ts.SyntaxKind.MethodDeclaration,
  ts.SyntaxKind.PropertyDeclaration,
  ts.SyntaxKind.PropertySignature,
  ts.SyntaxKind.Parameter,
]);
for (const p of [...walk('apps/api/src'), ...walk('packages/shared/src')]) {
  if (!p.endsWith('.ts') || p.includes('/generated/') || p.endsWith('.d.ts'))
    continue;
  const source = ts.createSourceFile(p, read(p), ts.ScriptTarget.Latest, true);
  const visit = (node: ts.Node): void => {
    if (REF_DECLARATION_KINDS.has(node.kind)) {
      const named = node as ts.Node & { name?: ts.Node };
      const name = named.name;
      if (
        name &&
        ts.isIdentifier(name) &&
        (/Ref$/.test(name.text) || name.text === 'ref' || name.text === 'refs')
      ) {
        const { line } = source.getLineAndCharacterOfPosition(
          name.getStart(source),
        );
        errors.push(
          `${p}:${line + 1} 标识符 ${name.text} 违反 NAM-5.2（禁止 Ref 命名）`,
        );
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

// 4) 后端命名：禁用角色后缀；domain 禁 helper / type
const BANNED =
  /\.(client|gateway|factory|limiter|metering|store|projection|provider|exception-filter|manager)\.ts$/;
for (const p of walk('apps/api/src')) {
  if (
    !p.endsWith('.ts') ||
    p.includes('/generated/') ||
    p.includes('/__tests__/')
  )
    continue;
  const rel = relative(ROOT, join(ROOT, p));
  if (BANNED.test(rel)) errors.push(`${rel} 使用了已删除的角色后缀`);
  if (/\/domain\/[^/]+\.(helper|type)\.ts$/.test(rel))
    errors.push(`${rel} domain 层禁止 helper / type 角色`);
}

// 3c) UI 设计系统硬检查：hex、内容阴影、离阶字号；内部标识只做候选
const SHADOW_ALLOWED = new Set([
  'apps/web/features/workspace/components/command-palette/index.tsx',
  'apps/web/components/table-view/parts/filter-bar.tsx',
]);
const candidates: string[] = [];
for (const p of webFiles) {
  const lines = read(p).split('\n');
  for (const [i, line] of lines.entries()) {
    const where = `${p}:${i + 1}`;
    if (/#[0-9a-fA-F]{3,8}\b/.test(line))
      errors.push(`${where} 业务代码禁止十六进制色值`);
    if (/shadow-/.test(line)) {
      const allowed = SHADOW_ALLOWED.has(p);
      if (!allowed)
        errors.push(
          `${where} 内容区禁止 shadow-*（仅命令面板允许 shadow-overlay）`,
        );
    }
    if (/text-\[[\d.]/.test(line))
      errors.push(`${where} 字号必须使用 text-[length:var(--text-*)] 令牌`);
    if (
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(line)
    )
      candidates.push(`${where} 疑似 UUID 出现在界面代码`);
    if (
      /\b(?:user|role|navigation|permission-point|model-provider):[a-z-]+/.test(
        line,
      )
    )
      candidates.push(`${where} 疑似权限码出现在界面代码`);
  }
}

// 3d) 令牌对比度：解析 globals.css 浅/暗主题，按 WCAG 2.2 校验关键组合
const globalCss = read('apps/web/app/globals.css');
const themeBlock = (selector: string): Record<string, string> => {
  const start = globalCss.indexOf(`${selector} {`);
  if (start < 0) return {};
  const open = globalCss.indexOf('{', start);
  const end = globalCss.indexOf('\n}', open);
  if (open < 0 || end < 0) return {};
  const block = globalCss.slice(open + 1, end);
  return Object.fromEntries(
    [...block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8});/g)].map((m) => [
      m[1],
      m[2],
    ]),
  );
};
const srgb = (hex: string): [number, number, number] => {
  const raw = hex.replace('#', '');
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
};
const luminance = (hex: string): number => {
  const [r, g, b] = srgb(hex).map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string): number => {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};
const CONTRAST_PAIRS: Array<[string, string, number, string]> = [
  ['foreground', 'background', 4.5, '正文'],
  ['muted-foreground', 'background', 4.5, '辅助文字'],
  ['primary', 'primary-foreground', 4.5, '主按钮'],
  ['primary', 'tint', 4.5, '选中文字'],
  ['destructive', 'background', 4.5, '危险文字'],
  ['success', 'background', 4.5, '成功文字'],
  ['warning', 'background', 4.5, '警告文字'],
  ['input', 'background', 3, '控件边界'],
  ['ring', 'background', 3, '焦点环'],
  ['chart-1', 'background', 3, '图表 1'],
  ['chart-2', 'background', 3, '图表 2'],
  ['chart-3', 'background', 3, '图表 3'],
  ['chart-4', 'background', 3, '图表 4'],
  ['chart-5', 'background', 3, '图表 5'],
];
for (const [name, tokens] of Object.entries({
  light: themeBlock(':root'),
  dark: themeBlock('.dark'),
})) {
  for (const [fg, bg, min, label] of CONTRAST_PAIRS) {
    const a = tokens[fg];
    const b = tokens[bg];
    if (!a || !b) {
      errors.push(`对比度令牌缺失：${name} ${fg}/${bg}`);
      continue;
    }
    const value = contrast(a, b);
    if (value < min)
      errors.push(
        `对比度不足：${name} ${label} ${fg}/${bg} = ${value.toFixed(2)} < ${min}`,
      );
  }
}
for (const p of featureFiles) {
  const text = read(p);
  const isForm = /\buseForm\b/.test(text);
  const derivesFromShared = /@cip\/shared/.test(text);
  for (const [i, line] of text.split('\n').entries()) {
    // 星标候选：同一行既有 aria-hidden 又有手写 *；图标 aria-hidden 不算
    if (/aria-hidden/.test(line) && /\*/.test(line))
      candidates.push(`${p}:${i + 1} 手写 aria-hidden 星标`);
    // 表单级错误候选：仅表单文件内、且不在查询错误兜底块（isError）里的裸 <p>
    const nearQueryError = /isError/.test(
      text
        .split('\n')
        .slice(Math.max(0, i - 3), i + 1)
        .join('\n'),
    );
    if (isForm && !nearQueryError && /<p[^>]*text-destructive/.test(line))
      candidates.push(`${p}:${i + 1} 表单内裸 text-destructive <p>`);
    // schema 单源候选：未引用 @cip/shared 的 z.object 才是裸写
    if (!derivesFromShared && /z\.object/.test(line))
      candidates.push(`${p}:${i + 1} 未基于 shared schema 的 z.object`);
  }
}

if (errors.length) {
  console.error(`check:rules 失败（${errors.length} 项）`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`rules ok: ${found.size} ids mapped, 0 unbound, 0 violations`);
if (candidates.length) {
  console.log(`review candidates: ${candidates.length}（不失败，需人工复核）`);
  for (const c of candidates.slice(0, 20)) console.log(`  ? ${c}`);
  if (candidates.length > 20)
    console.log(`  ... 其余 ${candidates.length - 20} 条`);
}
