#!/usr/bin/env node
/**
 * 检查设施保护：横切与架构测试、scripts/checks、hook、CI 和核心配置被改动时必须显式声明。
 * 用法：pnpm exec tsx scripts/checks/protected.ts [--update --decision NNNN]
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const BASELINE = 'scripts/checks/protected-files.json';
const collect = (dir: string): string[] =>
  existsSync(join(ROOT, dir))
    ? readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
        const path = `${dir}/${entry.name}`;
        return entry.isDirectory() ? collect(path) : [path];
      })
    : [];
const PROTECTED = [
  ...new Set([
    ...collect('scripts/checks').filter((p) => p !== BASELINE),
    ...collect('.husky').filter((p) => !p.startsWith('.husky/_/')),
    ...collect('apps/api/src/__tests__'),
    'apps/web/lib/__tests__/architecture.spec.ts',
    'apps/api/vitest.config.mts',
    'apps/web/vitest.config.mts',
    'apps/api/src/testing/__tests__/env.fixture.ts',
    'apps/api/src/testing/openapi.helper.ts',
    'biome.json',
    'commitlint.config.ts',
    'turbo.json',
    '.gitlab-ci.yml',
    '.gitignore',
    'package.json',
    'pnpm-workspace.yaml',
    'apps/api/tsconfig.json',
    'apps/web/tsconfig.json',
    'apps/api/tsconfig.ci.json',
    'apps/web/tsconfig.ci.json',
    'apps/api/package.json',
    'apps/web/package.json',
    'tsconfig.json',
  ]),
].sort();
const sha = (p: string): string =>
  createHash('sha256')
    .update(readFileSync(join(ROOT, p)))
    .digest('hex');

if (process.argv.includes('--update')) {
  const decision = process.argv[process.argv.indexOf('--decision') + 1];
  const adr =
    /^\d{4}$/.test(decision ?? '') &&
    readdirSync(join(ROOT, 'docs/decisions')).find((name) =>
      name.startsWith(`${decision}-`),
    );
  if (
    !adr ||
    !readFileSync(join(ROOT, 'docs/decisions', adr), 'utf8').includes(
      '状态：已接受',
    )
  ) {
    console.error('更新基线必须给出已确认的 ADR 编号：--decision NNNN');
    process.exit(1);
  }
  console.log(`保护基线治理依据：${adr}`);
  const next = Object.fromEntries(PROTECTED.map((p) => [p, sha(p)]));
  writeFileSync(join(ROOT, BASELINE), `${JSON.stringify(next, null, 2)}\n`);
  console.log(`protected baseline updated: ${PROTECTED.length} files`);
  process.exit(0);
}

if (!existsSync(join(ROOT, BASELINE))) {
  console.error(
    '缺少保护基线，先运行：pnpm exec tsx scripts/checks/protected.ts --update',
  );
  process.exit(1);
}
const baseline = JSON.parse(readFileSync(join(ROOT, BASELINE), 'utf8'));
const changed = [...new Set([...PROTECTED, ...Object.keys(baseline)])].filter(
  (p) => !existsSync(join(ROOT, p)) || baseline[p] !== sha(p),
);
if (!changed.length) {
  console.log(`protected ok: ${PROTECTED.length} files unchanged`);
  process.exit(0);
}
if (process.env.ALLOW_GATE_CHANGE === '1') {
  console.warn('检查设施变更已显式声明（ALLOW_GATE_CHANGE=1）：');
  for (const p of changed) console.warn(`  ~ ${p}`);
  console.warn(
    '确认治理决定后运行 pnpm exec tsx scripts/checks/protected.ts --update --decision NNNN 更新基线。',
  );
  process.exit(0);
}
console.error('检查设施被修改，必须显式声明（防止顺手放宽检查）：');
for (const p of changed) console.error(`  ~ ${p}`);
console.error(
  '如确为治理变更：写 ADR → ALLOW_GATE_CHANGE=1 提交 → pnpm exec tsx scripts/checks/protected.ts --update',
);
process.exit(1);
