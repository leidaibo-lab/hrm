/**
 * 上下文登记表：database.md 是上下文与物理前缀的唯一来源。
 * 解析不到登记表必须抛错（fail closed），避免文档被改写后检查静默失效。
 */
export interface ContextRule {
  /** 业务上下文名，kebab-case。 */
  context: string;
  /** 物理表前缀，含尾下划线；null 表示该上下文不使用前缀。 */
  prefix: string | null;
  /** 归属模块路径，相对仓库根；空字符串表示预留、尚未创建。 */
  module: string;
  /** 预留上下文允许暂无模型与目录。 */
  reserved: boolean;
}

const STATE = new Map<string, boolean>([
  ['已启用', false],
  ['预留', true],
]);

/** 解析 database.md 的四列登记表；格式非法立即抛错。 */
export function parseContextRegistry(markdown: string): ContextRule[] {
  const rules: ContextRule[] = [];
  for (const line of markdown.split('\n')) {
    if (!line.trimStart().startsWith('|')) continue;
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length !== 4) continue;
    const context = /^`([a-z][a-z0-9-]*)`$/.exec(cells[0]);
    const reserved = STATE.get(cells[3]);
    if (!context || reserved === undefined) continue;
    let prefix: string | null = null;
    if (cells[1] !== '无') {
      const hit = /^`([a-z][a-z0-9]*(?:_[a-z0-9]+)*_)`$/.exec(cells[1]);
      if (!hit)
        throw new Error(`上下文 ${context[1]} 的前缀格式非法：${cells[1]}`);
      prefix = hit[1];
    }
    const moduleCell = cells[2];
    let module = '';
    if (!moduleCell.startsWith('—')) {
      const hit = /^`(apps\/[^`]+)`$/.exec(moduleCell);
      if (!hit)
        throw new Error(`上下文 ${context[1]} 的模块路径非法：${moduleCell}`);
      module = hit[1];
    }
    rules.push({
      context: context[1],
      prefix,
      module,
      reserved,
    });
  }
  if (rules.length === 0) throw new Error('database.md 未解析到上下文登记表');
  return rules;
}
