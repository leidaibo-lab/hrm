import type { ContextRule } from './lib/contexts.js';
import type { Diagnostic } from './lib/diagnostics.js';

/** 只用于结构候选提取；完整 Prisma 语法必须另外通过 prisma validate。 */
export function schemaModels(text: string): Map<string, string> {
  const models = new Map<string, string>();
  const masked = text.replace(/\/\/[^\n]*|"(?:\\.|[^"\\])*"/g, (part) =>
    part.replace(/[^\n]/g, ' '),
  );
  for (const match of masked.matchAll(/\bmodel\s+(\w+)\s*\{/g)) {
    const opening = match.index + match[0].lastIndexOf('{');
    let end = opening + 1;
    let depth = 1;
    while (end < masked.length && depth > 0) {
      if (masked[end] === '{') depth++;
      if (masked[end] === '}') depth--;
      end++;
    }
    if (depth > 0)
      throw new Error(`模型 ${match[1]} 无法解析，必须先修复 schema`);
    let start = text.lastIndexOf('\n', match.index) + 1;
    while (start > 0) {
      const previous = text.lastIndexOf('\n', start - 2) + 1;
      if (!text.slice(previous, start).trim().startsWith('//')) break;
      start = previous;
    }
    models.set(match[1], text.slice(start, end).trim());
  }
  return models;
}

/** 表名必须与登记上下文一致；未登记上下文或前缀不符返回违规说明。 */
export function checkTableNaming(
  block: string,
  table: string,
  contexts: ContextRule[],
): string | null {
  const declared = /^\/\/ 域: ([a-z][a-z0-9-]*)/.exec(block);
  if (!declared) return '模型首行必须声明 `// 域: <上下文>`';
  const context = declared[1];
  const entry = contexts.find((item) => item.context === context);
  if (!entry) return `域 ${context} 未在 database.md 上下文登记表登记`;
  if (entry.prefix) {
    if (!table.startsWith(entry.prefix))
      return `域 ${entry.context} 的表名必须以 ${entry.prefix} 开头`;
    return null;
  }
  const foreign = contexts.find(
    (item) => item.prefix !== null && table.startsWith(item.prefix),
  );
  if (foreign)
    return `域 ${entry.context} 无前缀，不得使用 ${foreign.prefix} 前缀`;
  const own = `${entry.context.replaceAll('-', '_')}_`;
  if (table.startsWith(own))
    return `域 ${entry.context} 无前缀，不得以域名作表前缀`;
  return null;
}

/** 检查新增/修改模型，不将未触及模型隐式加入历史基线。 */
export function checkDatabase(
  text: string,
  before: string,
  contexts: ContextRule[],
): Diagnostic[] {
  const old = schemaModels(before);
  const result: Diagnostic[] = [];
  const file = 'apps/api/prisma/schema.prisma';
  const models = schemaModels(text);
  for (const [name, block] of models) {
    if (block === old.get(name)) continue;
    const line = text.slice(0, text.indexOf(block)).split('\n').length;
    const add = (
      rule: string,
      message: string,
      kind: Diagnostic['kind'] = 'violation',
    ) =>
      result.push({ rule, file, line, message: `${name}: ${message}`, kind });
    const body = block.replace(/\/\/[^\n]*/g, '');
    if (
      !/@(?:@)?id\b/.test(body) ||
      !/@@map\("[a-z][a-z0-9_]*"\)/.test(body) ||
      !/^\s*\/\//.test(block)
    )
      add('DB-4.1', '模型必须有职责说明、显式主键和蛇形物理表映射');
    const table = /@@map\("([^"]+)"\)/.exec(body)?.[1];
    if (table) {
      const naming = checkTableNaming(block, table, contexts);
      if (naming) add('DB-4.2', naming);
    }
    for (const relation of body.matchAll(/@relation\s*\(([\s\S]*?)\)/g)) {
      if (
        /\bfields\s*:/.test(relation[1]) &&
        !/\bonDelete\s*:\s*(?:Restrict|Cascade|SetNull|NoAction|SetDefault)\b/.test(
          relation[1],
        )
      ) {
        add('DB-5.1', '持有外键的关系必须显式声明 onDelete，具体策略需要评审');
      }
    }
    const indexes = [...body.matchAll(/@@index\(\s*\[([^\]]+)\]/g)].map((m) =>
      m[1].replace(/\s/g, ''),
    );
    if (new Set(indexes).size !== indexes.length)
      add('DB-6.1', '禁止重复声明相同字段顺序的普通索引');
    add(
      'DB-REVIEW',
      '核对字段说明、唯一范围、精度、单位、删除策略、索引依据及隔离数据库行为证据',
      'review',
    );
  }
  return result;
}

/** 已进入目标基准的迁移不可重写；新迁移中的破坏性语句输出人工项。 */
export function checkMigration(
  file: string,
  text: string | null,
  before: string | null,
): Diagnostic[] {
  if (before !== null && before !== text)
    return [
      {
        file,
        line: 1,
        rule: 'PER-4.2',
        kind: 'violation',
        message: '基准已有迁移禁止修改或删除，修正必须新增迁移',
      },
    ];
  if (
    text &&
    /\b(?:DROP\s+(?:TABLE|COLUMN|TYPE)|TRUNCATE|ALTER\s+COLUMN|SET\s+NOT\s+NULL)\b/i.test(
      text,
    )
  )
    return [
      {
        file,
        line: 1,
        rule: 'DB-MIGRATION',
        kind: 'review',
        message:
          '迁移含潜在破坏性变更，必须核对数据回填、锁表、新旧版本兼容与恢复证据',
      },
    ];
  return [];
}

/** 只在真实 DDL 非空时要求新迁移；注释或纯 ORM 变化不机械阻断。 */
export function checkMigrationRequired(
  ddl: string,
  newMigrations: string[],
): Diagnostic[] {
  const meaningful = ddl
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim();
  if (!meaningful || newMigrations.length > 0) return [];
  return [
    {
      rule: 'DB-7.1',
      file: 'apps/api/prisma/schema.prisma',
      line: 1,
      kind: 'violation',
      message: '真实数据库结构发生变化但没有新增迁移；必须生成并评审迁移',
    },
  ];
}
