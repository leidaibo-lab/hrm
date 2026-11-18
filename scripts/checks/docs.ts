#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
/**
 * docs 机检：篇数、三元组、index 清单、根目录、PRD 命名与章节、引用断链、代码路径、命令存在性、版本一致。
 * 规则来源：docs/governance.md「检查入口」「规模预算」；命令来源：docs/reference/verification.md。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 文档与治理检查的唯一实现；CLI 和测试消费同一结果，不在导入时执行。 */
export function checkDocs(ROOT: string): {
  errors: string[];
  documentCount: number;
  commandCount: number;
} {
  const ENTRY = ['AGENTS.md', 'docs/index.md', 'docs/governance.md'];
  const DOC_DIRS = ['docs/process', 'docs/conventions', 'docs/reference'];
  const ROOT_MD_ALLOWED = ['README.md', 'AGENTS.md', 'CLAUDE.md'];
  const GENERATED = [
    'apps/web/lib/api-client/',
    'apps/api/src/platform/prisma/generated/',
  ];
  const errors: string[] = [];

  const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8');
  const current = [
    ...ENTRY,
    ...DOC_DIRS.flatMap((dir) =>
      readdirSync(join(ROOT, dir))
        .filter((name) => name.endsWith('.md'))
        .sort()
        .map((name) => `${dir}/${name}`),
    ),
  ];

  // 1) 篇数（唯一定义在 governance.md「规模预算」为 23）
  if (current.length > 23) {
    errors.push(`现行文档篇数不得超过 23，实际 ${current.length}`);
  }

  // 2) index.md 是清单
  const index = read('docs/index.md');
  for (const p of current) {
    if (!index.includes(p)) errors.push(`index.md 未列出 ${p}`);
  }

  // 2b) 逐篇行数上限（与 governance「规模预算」一致）
  const BUDGETS: Record<string, number> = {
    'AGENTS.md': 90,
    'docs/index.md': 80,
    'docs/governance.md': 150,
  };
  const DIR_BUDGET = {
    'docs/process': 120,
    'docs/conventions': 120,
    'docs/reference': 160,
  };
  for (const p of current) {
    const limit =
      BUDGETS[p] ??
      Object.entries(DIR_BUDGET).find(([d]) => p.startsWith(`${d}/`))?.[1];
    if (!limit) continue;
    const text = read(p);
    const n = text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
    if (n > limit) errors.push(`${p} 行数 ${n} 超过上限 ${limit}`);
  }

  // 3) 第 3 行三元组三字段
  for (const p of current) {
    const third = read(p).split('\n')[2] ?? '';
    if (
      !/^> 层：(规范|描述) · 时态：(约束未来|描述现在) · 失效：.+$/.test(third)
    ) {
      errors.push(`${p}:3 三元组不合法：${third.slice(0, 60)}`);
    }
  }

  // 4) 根目录游离文档
  for (const name of readdirSync(ROOT)) {
    if (name.endsWith('.md') && !ROOT_MD_ALLOWED.includes(name)) {
      errors.push(`根目录存在未纳管文档 ${name}`);
    }
  }

  // 4b) PRD：扁平单篇与目录式（DOC-3.2 / DOC-3.3）
  // 目录式：agentic 使用 PRD 规范 v2（ADR-0076），其他目录暂用旧模板。
  const prdDir = join(ROOT, 'docs/prd');
  const LEGACY_INDEX_SECTIONS = [
    '一、文档信息',
    '二、概述',
    '三、背景与上下文',
    '四、目标与成功指标',
    '五、非目标',
    '六、用户与场景',
    '七、功能需求',
    '八、交互与设计',
    '九、非功能需求',
    '十、数据需求',
    '十一、假设与依赖',
    '十二、里程碑',
    '十三、验收标准',
    '十四、开放问题',
    '十五、附录',
    '十六、技术执行规格',
    '十七、AI 执行清单',
    '十八、变更记录',
  ];
  const LEGACY_TOPIC_SECTIONS = [
    '一、文档信息',
    '二、范围与非目标',
    '三、现状与约束',
    '四、设计',
    '五、接口与数据',
    '六、验收标准',
    '七、风险与开放问题',
    '八、变更记录',
  ];
  const AGENTIC_INDEX_SECTIONS = [
    '一、文档信息',
    '二、产品定位与价值',
    '三、背景与问题',
    '四、目标用户与场景',
    '五、范围与非目标',
    '六、功能全景',
    '七、一页架构',
    '八、非功能需求与成功指标',
    '九、数据与埋点需求',
    '十、验收总览',
    '十一、阅读路径与文档索引',
    '十二、假设、依赖与里程碑',
    '十三、开放问题',
    '十四、变更记录',
  ];
  const AGENTIC_DESIGN_SECTIONS = [
    '一、文档信息',
    '二、总体架构与 Super-agent 运行模型',
    '三、领域模型',
    '四、端到端数据流',
    '五、技术方案',
    '六、文件结构与模块职责',
    '七、数据模型',
    '八、接口与契约',
    '九、扩展与接入',
    '十、部署与运维',
    '十一、设计边界、风险与待决项',
    '十二、变更记录',
  ];
  const AGENTIC_FEATURE_SECTIONS = [
    '一、文档信息',
    '二、产品规格（A）',
    'A1 功能目标与非目标',
    'A2 角色与入口',
    'A3 功能逻辑与判定',
    'A4 状态与数据流转',
    'A5 交互与异常',
    'A6 扩展与接入点',
    'A7 验收要点',
    '三、技术设计（B）',
    'B1 模块与文件',
    'B2 数据表',
    'B3 接口与队列',
    'B4 运行时与框架',
    'B5 配置与部署',
    'B6 实现决策索引',
    'B7 测试与验收映射',
    '四、变更记录',
  ];
  const AGENTIC_FEATURES = [
    '01-source.md',
    '02-triage.md',
    '03-ticket.md',
    '04-gate.md',
    '05-artifact.md',
    '06-console.md',
  ];
  /** PRD 规范 v3 目录（ADR-0079）：目录 → 必需文件。 */
  const PRD_V3_DIRS: Record<string, string[]> = {
    agentic: ['design.md', ...AGENTIC_FEATURES],
    'model-gateway': [
      'design.md',
      '01-provider-model.md',
      '02-routing-metering.md',
    ],
    iam: ['design.md', '01-identity-space.md', '02-authorization.md'],
  };
  const escapeRegExp = (value: string): string =>
    value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const checkHeadings = (
    fullPath: string,
    label: string,
    headings: string[],
    exact = true,
  ): void => {
    const text = readFileSync(fullPath, 'utf8');
    for (const heading of headings) {
      const suffix = exact ? '$' : '';
      const pattern = new RegExp(
        `^#{2,3} ${escapeRegExp(heading)}${suffix}`,
        'm',
      );
      if (!pattern.test(text)) {
        errors.push(`${label} 缺少模板章节 ${heading}`);
      }
    }
  };
  if (existsSync(prdDir)) {
    for (const entry of readdirSync(prdDir, { withFileTypes: true })) {
      if (entry.name === '_TEMPLATE.md') continue;
      const full = join(prdDir, entry.name);
      if (entry.isDirectory()) {
        if (!/^[a-z0-9-]+$/.test(entry.name)) {
          errors.push(`prd 目录命名不合规：${entry.name}`);
          continue;
        }
        const indexFile = join(full, 'index.md');
        if (!existsSync(indexFile)) {
          errors.push(`prd 目录 ${entry.name} 缺少 index.md`);
          continue;
        }
        if (!index.includes(`docs/prd/${entry.name}/index.md`)) {
          errors.push(`index.md 未列出 docs/prd/${entry.name}/index.md`);
        }
        const requiredFiles = PRD_V3_DIRS[entry.name];
        if (requiredFiles) {
          checkHeadings(
            indexFile,
            `${entry.name}/index.md`,
            AGENTIC_INDEX_SECTIONS,
          );
          for (const sub of readdirSync(full, { withFileTypes: true })) {
            if (sub.isDirectory()) {
              errors.push(`prd 目录只允许一层：${entry.name}/${sub.name}`);
              continue;
            }
            if (!sub.name.endsWith('.md') || sub.name === 'index.md') continue;
            const label = `${entry.name}/${sub.name}`;
            if (!/^[a-z0-9-]+\.md$/.test(sub.name)) {
              errors.push(`prd 文件命名不合规：${label}`);
              continue;
            }
            if (sub.name === 'design.md') {
              checkHeadings(
                join(full, sub.name),
                label,
                AGENTIC_DESIGN_SECTIONS,
              );
              continue;
            }
            if (/^\d{2}-[a-z0-9-]+\.md$/.test(sub.name)) {
              checkHeadings(
                join(full, sub.name),
                label,
                AGENTIC_FEATURE_SECTIONS,
              );
              continue;
            }
            errors.push(`prd 文件未登记模板：${label}`);
          }
          for (const required of requiredFiles) {
            if (!existsSync(join(full, required))) {
              errors.push(`prd 目录 ${entry.name} 缺少 ${required}`);
            }
          }
          continue;
        }
        checkHeadings(
          indexFile,
          `${entry.name}/index.md`,
          LEGACY_INDEX_SECTIONS,
          false,
        );
        for (const sub of readdirSync(full, { withFileTypes: true })) {
          if (sub.isDirectory()) {
            errors.push(`prd 目录只允许一层：${entry.name}/${sub.name}`);
            continue;
          }
          if (!sub.name.endsWith('.md') || sub.name === 'index.md') continue;
          if (!/^[a-z0-9-]+\.md$/.test(sub.name)) {
            errors.push(`prd 文件命名不合规：${entry.name}/${sub.name}`);
            continue;
          }
          checkHeadings(
            join(full, sub.name),
            `${entry.name}/${sub.name}`,
            LEGACY_TOPIC_SECTIONS,
            false,
          );
        }
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const named =
        /^\d{8}-[a-z0-9-]+\.md$/.test(entry.name) ||
        /^[a-z0-9-]+\.md$/.test(entry.name);
      if (!named) {
        errors.push(`prd 文件命名不合规：${entry.name}`);
        continue;
      }
      checkHeadings(full, entry.name, LEGACY_INDEX_SECTIONS, false);
    }
  }

  const basenames = new Set(
    [
      ...current,
      'README.md',
      'CLAUDE.md',
      ...readdirSync(join(ROOT, 'docs/decisions')).map(
        (n) => `docs/decisions/${n}`,
      ),
    ].map((p) => p.split('/').pop()),
  );

  // 5) 引用完整性：.md 与代码路径
  for (const p of current) {
    const text = read(p);
    for (const match of text.matchAll(/`([^`\n]+\.md)`/g)) {
      const ref = match[1];
      if (/[*<>{}]|NNNN/.test(ref) || /^https?:/.test(ref)) continue;
      const found = ref.includes('/')
        ? [resolve(ROOT, dirname(p), ref), resolve(ROOT, ref)].some((file) =>
            existsSync(file),
          )
        : basenames.has(ref);
      if (!found) errors.push(`${p} 引用不存在的文档 ${ref}`);
    }
    for (const match of text.matchAll(/`((?:apps|packages)[/][^`\n]+)`/g)) {
      const ref = match[1];
      if (/[*<>{}]/.test(ref)) continue;
      if (GENERATED.some((g) => `${ref}/`.startsWith(g))) continue;
      if (!existsSync(join(ROOT, ref)))
        errors.push(`${p} 引用不存在的代码路径 ${ref}`);
    }
  }

  // 5b) 生成产物不得入 git
  const tracked = spawnSync('git', ['ls-files'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).stdout.split('\n');
  for (const file of tracked) {
    if (GENERATED.some((g) => file.startsWith(g)))
      errors.push(`生成产物已入库：${file}`);
  }

  // 6) 命令注册表：非「待落地」行的 pnpm 脚本必须真实存在
  const packageOf = (name: string | null) => {
    if (name === null)
      return { dir: '.', pkg: JSON.parse(read('package.json')) };
    const short = name.replace('@cip/', '');
    const dir = [`apps/${short}`, `packages/${short}`].find((d) =>
      existsSync(join(ROOT, d, 'package.json')),
    );
    return dir
      ? {
          dir,
          pkg: JSON.parse(
            readFileSync(join(ROOT, dir, 'package.json'), 'utf8'),
          ),
        }
      : null;
  };
  const registry = read('docs/reference/verification.md');
  let commandCount = 0;
  for (const line of registry.split('\n')) {
    if (
      !line.startsWith('|') ||
      line.includes('待落地') ||
      /^\|\s*-+/.test(line)
    )
      continue;
    const firstCell = line.split('|')[1] ?? '';
    for (const match of firstCell.matchAll(/`([^`\n]+)`/g)) {
      const cmd = match[1];
      if (!cmd.startsWith('pnpm')) continue;
      commandCount++;
      const parsed = /^pnpm(?:\s+--filter\s+(\S+))?(?:\s+exec)?\s+(\S+)/.exec(
        cmd,
      );
      if (!parsed) {
        errors.push(`无法解析命令 ${cmd}`);
        continue;
      }
      const [, filter, script] = parsed;
      const target = packageOf(filter ?? null);
      if (!target) {
        errors.push(`命令 ${cmd} 的包不存在`);
        continue;
      }
      if (script === 'exec' || /\sexec\s/.test(cmd)) continue;
      const scripts = target.pkg.scripts ?? {};
      if (!(script in scripts) && script !== 'install') {
        errors.push(
          `命令 ${cmd} 的脚本 ${script} 不存在于 ${target.dir}/package.json`,
        );
      }
    }
  }

  // 7) 版本事实：index「技术栈」行 vs package.json
  const dep = (pkgPath: string, name: string): string | null => {
    const pkg = JSON.parse(readFileSync(join(ROOT, pkgPath), 'utf8'));
    const v = pkg.dependencies?.[name] ?? pkg.devDependencies?.[name];
    return v ? String(v).replace(/^[\^~]/, '') : null;
  };
  const stack: Array<[RegExp, string | null]> = [
    [/Next\.js (\d+\.\d+)/, dep('apps/web/package.json', 'next')],
    [/NestJS (\d+)/, dep('apps/api/package.json', '@nestjs/core')],
    [/React (\d+\.\d+)/, dep('apps/web/package.json', 'react')],
    [/TypeScript \^?(\d+\.\d+)/, dep('apps/api/package.json', 'typescript')],
    [/turbo (\d+\.\d+)/, dep('package.json', 'turbo')],
    [/Prisma (\d+\.\d+)/, dep('apps/api/package.json', '@prisma/client')],
    [/zod (\d+)/, dep('apps/api/package.json', 'zod')],
    [/Biome (\d+\.\d+)/, dep('package.json', '@biomejs/biome')],
    [/Vitest (\d+)/, dep('apps/api/package.json', 'vitest')],
  ];
  for (const [re, actual] of stack) {
    const hit = re.exec(index);
    if (!hit) {
      errors.push(`index.md 技术栈缺少 ${re}`);
      continue;
    }
    if (!actual?.startsWith(hit[1])) {
      errors.push(`index.md 版本 ${hit[1]} 与实际 ${actual} 不一致（${re}）`);
    }
  }
  const pm = JSON.parse(read('package.json')).packageManager ?? '';
  const pmHit = /pnpm (\d+\.\d+)/.exec(index);
  if (!pmHit || !pm.replace('pnpm@', '').startsWith(pmHit[1])) {
    errors.push(`index.md pnpm 版本与实际 ${pm} 不一致`);
  }

  const adrDir = join(ROOT, 'docs/decisions');
  const adrs = readdirSync(adrDir)
    .filter((n) => /^\d{4}-.*\.md$/.test(n))
    .sort();
  adrs.forEach((name, i) => {
    const n = Number(name.slice(0, 4));
    if (n !== i + 1)
      errors.push(
        `ADR 编号不连续：${name} 应为 ${String(i + 1).padStart(4, '0')}`,
      );
    const text = readFileSync(join(adrDir, name), 'utf8');
    const third = text.split('\n')[2] ?? '';
    if (
      !/^> 状态：(已接受|已取代).*· 日期：\d{4}-\d{2}-\d{2} · 级别：L[0-3]/.test(
        third,
      )
    ) {
      errors.push(`${name} 第 3 行状态头不合规`);
    }
  });
  const SPECS = [
    'architecture',
    'routes',
    'endpoint-audit',
    'code-comments',
    'docs-governance',
    'persistence',
  ];
  for (const s of SPECS) {
    if (!existsSync(join(ROOT, `apps/api/src/__tests__/${s}.spec.ts`)))
      errors.push(`缺少横切 spec：${s}.spec.ts`);
  }
  return { errors, documentCount: current.length, commandCount };
}

const entry = process.argv[1];
if (entry && resolve(entry) === fileURLToPath(import.meta.url)) {
  const result = checkDocs(
    resolve(dirname(fileURLToPath(import.meta.url)), '../..'),
  );
  if (result.errors.length) {
    console.error(`check:docs 失败（${result.errors.length} 项）`);
    for (const error of result.errors) console.error(`  - ${error}`);
    process.exitCode = 1;
  } else
    console.log(
      `docs ok: ${result.documentCount} docs, ${result.commandCount} commands checked, ADR/spec 清单通过（不代表测试已执行）`,
    );
}
