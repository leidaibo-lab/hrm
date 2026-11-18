import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PERMISSION_CATALOG } from '@cip/shared';
import { describe, expect, it } from 'vitest';

const DOCS = [
  resolve(process.cwd(), 'docs/prd/agentic'),
  resolve(process.cwd(), '../../docs/prd/agentic'),
].find((path) => existsSync(path)) as string;
const FEATURES = [
  '01-source.md',
  '02-triage.md',
  '03-ticket.md',
  '04-gate.md',
  '05-artifact.md',
  '06-console.md',
];
const TABLES = [
  'agentic_threads',
  'agentic_triggers',
  'agentic_reply_targets',
  'agentic_source_instances',
  'agentic_source_health',
  'agentic_source_authorizations',
  'agentic_policies',
  'agentic_admission_rules',
  'agentic_decisions',
  'agentic_decision_triggers',
  'agentic_tickets',
  'agentic_mandates',
  'agentic_assignments',
  'agentic_subscriptions',
  'agentic_attentions',
  'agentic_reports',
  'agentic_artifacts',
  'agentic_effects',
  'agentic_outbound_messages',
  'agentic_trace_spans',
];

const readDoc = (name: string): Promise<string> =>
  readFile(resolve(DOCS, name), 'utf8');

const slice = (text: string, start: string, end: string): string => {
  const from = text.indexOf(start);
  if (from < 0) throw new Error(`缺少章节：${start}`);
  const to = text.indexOf(end, from + 1);
  return text.slice(from, to < 0 ? undefined : to);
};

/** 产品段正文：剔除表格行与验收复选框行，避免状态/证据触发禁词。 */
const prose = (text: string): string =>
  text
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('|'))
    .filter((line) => !/^- \[(?: |x)\] /.test(line))
    .join('\n');

const acLines = (text: string): string[] =>
  text.split('\n').filter((line) => /^- \[(?: |x)\] /.test(line));

describe('PRD 结构一致性（规范 v3）', () => {
  it('目录式 PRD 文件齐全', async () => {
    for (const name of ['index.md', 'design.md', ...FEATURES]) {
      expect(existsSync(resolve(DOCS, name)), name).toBe(true);
    }
  });

  it('所有文档共用同一版本号 V3.0（2026-11-17）', async () => {
    for (const name of ['index.md', 'design.md', ...FEATURES]) {
      const text = await readDoc(name);
      expect(
        /\|\s*版本\s*\|\s*V3\.0（2026-11-17）/.test(text),
        `${name} 版本不一致`,
      ).toBe(true);
    }
  });

  it('每个功能域有 A7 复选框验收且编号前缀正确', async () => {
    for (const [index, name] of FEATURES.entries()) {
      const text = await readDoc(name);
      const a7 = slice(text, '### A7 验收要点', '## 三、技术设计（B）');
      const lines = acLines(a7);
      expect(lines.length, name).toBeGreaterThanOrEqual(3);
      const prefix = `AC-${String(index + 1).padStart(2, '0')}-`;
      for (const line of lines) {
        expect(line.includes(prefix), `${name} 前缀应为 ${prefix}`).toBe(true);
        expect(line.includes('证据：'), `${name} 缺证据：${line}`).toBe(true);
      }
      expect(/^\|\s*AC-\d{2}-\d{2}/m.test(a7), `${name} 仍在用验收表格`).toBe(
        false,
      );
    }
  });

  it('AC 编号全局唯一', async () => {
    const ids: string[] = [];
    for (const name of FEATURES) {
      const text = await readDoc(name);
      const a7 = slice(text, '### A7 验收要点', '## 三、技术设计（B）');
      ids.push(
        ...[...a7.matchAll(/^- \[(?: |x)\] (AC-\d{2}-\d{2}) /gm)].map(
          (match) => match[1],
        ),
      );
    }
    const index = await readDoc('index.md');
    const overview = slice(index, '## 十、验收总览', '## 十一、');
    ids.push(
      ...[
        ...overview.matchAll(
          /^- \[(?: |x)\] ((?:AC-\d{2}-\d{2}|E2E-\d{2}|NF-\d{2})) /gm,
        ),
      ].map((match) => match[1]),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('产品段不写实现细节', async () => {
    const banned = [
      '已实现',
      '待验证',
      '部分实现',
      '迁移',
      'schema.prisma',
      'apps/',
      'packages/',
      'ADR-',
    ];
    for (const name of FEATURES) {
      const text = await readDoc(name);
      const product = prose(
        slice(text, '## 二、产品规格（A）', '## 三、技术设计（B）'),
      );
      for (const token of banned) {
        expect(product.includes(token), `${name} 产品段出现 ${token}`).toBe(
          false,
        );
      }
    }
  });

  it('实现段不写进度与完成度', async () => {
    const banned = ['已实现', '部分实现', '待验证', '未实现', '完成度'];
    for (const name of FEATURES) {
      const text = await readDoc(name);
      const impl = prose(
        slice(text, '## 三、技术设计（B）', '## 四、变更记录'),
      );
      for (const token of banned) {
        expect(impl.includes(token), `${name} 实现段出现 ${token}`).toBe(false);
      }
    }
  });

  it('设计篇不写进度与完成度', async () => {
    const text = await readDoc('design.md');
    for (const token of ['已实现', '部分实现', '待验证', '完成度']) {
      expect(prose(text).includes(token), `设计篇出现 ${token}`).toBe(false);
    }
  });

  it('权限点都在共享权限目录中', async () => {
    const known = new Set(
      PERMISSION_CATALOG.map((permission) => permission.code),
    );
    const codes = new Set<string>();
    for (const name of ['design.md', ...FEATURES]) {
      const text = await readDoc(name);
      for (const match of text.matchAll(
        /`((?:ticket|artifact|source|policy|audit|agent):[a-z]+)`/g,
      )) {
        codes.add(match[1]);
      }
    }
    expect([...codes].filter((code) => !known.has(code))).toEqual([]);
  });

  it('主 PRD 功能全景覆盖 F1–F6', async () => {
    const index = await readDoc('index.md');
    for (let feature = 1; feature <= 6; feature += 1) {
      expect(new RegExp(`^\\|\\s*F${feature}\\s*\\|`, 'm').test(index)).toBe(
        true,
      );
    }
  });

  it('设计篇登记全部 agentic 表', async () => {
    const design = await readDoc('design.md');
    for (const table of TABLES) {
      expect(design.includes(table), table).toBe(true);
    }
  });
});
